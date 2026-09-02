/**
 * تست دودی (smoke test) مسیر رزرو نوبت — بدون نیاز به مرورگر.
 * اجرا:  npm run test:smoke
 * دیتای تستی ساخته و در پایان پاک می‌شود.
 */
import "../src/lib/timezone";
import { PrismaClient } from "@prisma/client";
import { getAvailableSlots } from "../src/lib/availability";
import { createBooking, trackAppointment } from "../src/app/actions/booking";
import { atTime, parseYmdKey } from "../src/lib/date";
import { summarizePackages, activePackages } from "../src/lib/packages";
import { buildReport } from "../src/lib/reports";

const prisma = new PrismaClient();

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

async function main() {
  let failures = 0;
  const check = (name: string, pass: boolean) => {
    console.log(`${pass ? "✅" : "❌"} ${name}`);
    if (!pass) failures++;
  };

  const service = await prisma.service.findUniqueOrThrow({ where: { slug: "laser" } });
  const d = new Date(); d.setDate(d.getDate() + 5);
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const slots = await getAvailableSlots({ serviceId: service.id, dateKey });
  check(`محاسبه‌ی نوبت‌های خالی برای ${dateKey} (${slots.length} اسلات)`, slots.length > 0);
  if (slots.length === 0) process.exit(1);

  const res = await createBooking(fd({
    serviceId: service.id, dateKey, time: slots[0].time,
    firstName: "تست", lastName: "کاربر", phone: "۰۹۱۲۹۹۹۸۸۷۷", note: "تست خودکار",
  }));
  check("ثبت نوبت جدید", res.ok);
  if (!res.ok) {
    console.error(res);
    process.exit(1);
  }
  if (!("code" in res)) {
    console.error("انتظار می‌رفت نوبت مستقیم ثبت شود، نه هدایت به درگاه.", res);
    process.exit(1);
  }
  console.log(`   کد پیگیری: ${res.code} — ${res.summary}`);

  // همان اسلات دیگر نباید آزاد باشد
  const after = await getAvailableSlots({ serviceId: service.id, dateKey });
  check("اسلات رزروشده دیگر آزاد نیست (جلوگیری از رزرو تکراری)", !after.some((s) => s.time === slots[0].time));

  // پیگیری
  const t = await trackAppointment(null, fd({ code: res.code, phone: "09129998877" }));
  check("پیگیری نوبت با کد و شماره موبایل", t.ok && t.appointment.code === res.code);

  // ورودی نامعتبر
  const bad = await createBooking(fd({
    serviceId: service.id, dateKey, time: slots[1]?.time ?? "10:00",
    firstName: "ا", lastName: "", phone: "123",
  }));
  check("رد ورودی نامعتبر با پیام فارسی", !bad.ok && Object.keys(bad.errors ?? {}).length === 3);

  // ─── بافر بین نوبت‌ها ───
  // نوبت رزروشده باید علاوه بر مدت خودش، بافر بعدش را هم اشغال کند.
  await prisma.setting.upsert({
    where: { key: "slotStepMinutes" },
    create: { key: "slotStepMinutes", value: "15" },
    update: { value: "15" },
  });
  const fineGrained = await getAvailableSlots({ serviceId: service.id, dateKey });
  const booked = await prisma.appointment.findFirst({
    where: { customer: { phone: "09129998877" } },
    orderBy: { startsAt: "desc" },
  });
  const endMinutes = booked!.endsAt.getHours() * 60 + booked!.endsAt.getMinutes();
  const firstAfter = fineGrained
    .map((s) => Number(s.time.split(":")[0]) * 60 + Number(s.time.split(":")[1]))
    .filter((m) => m >= endMinutes)
    .sort((a, b) => a - b)[0];
  check(
    `بافر ${service.bufferMinutes} دقیقه‌ای بعد از نوبت رزروشده رعایت می‌شود`,
    firstAfter === undefined || firstAfter >= endMinutes + service.bufferMinutes
  );
  await prisma.setting.deleteMany({ where: { key: "slotStepMinutes" } });

  // ─── گام زمانی اختصاصی خدمت ───
  await prisma.service.update({ where: { id: service.id }, data: { slotStepMinutes: 60 } });
  const hourly = await getAvailableSlots({ serviceId: service.id, dateKey });
  check(
    "گام زمانی اختصاصی خدمت اعمال می‌شود (همه‌ی اسلات‌ها سر ساعت)",
    hourly.length > 0 && hourly.every((s) => s.time.endsWith(":00"))
  );
  await prisma.service.update({ where: { id: service.id }, data: { slotStepMinutes: null } });

  // ─── قفل نوبت هنگام پرداخت ───
  const holdSlot = (await getAvailableSlots({ serviceId: service.id, dateKey }))[2];
  const holdStart = atTime(parseYmdKey(dateKey), holdSlot.time);
  const held = await prisma.appointment.create({
    data: {
      code: "SMOKE-HOLD",
      customerId: (await prisma.customer.findFirstOrThrow({ where: { phone: "09129998877" } })).id,
      serviceId: service.id,
      staffId: holdSlot.staffId,
      startsAt: holdStart,
      endsAt: new Date(holdStart.getTime() + service.durationMinutes * 60_000),
      status: "PENDING",
      source: "smoke",
      holdExpiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });
  const whileHeld = await getAvailableSlots({ serviceId: service.id, dateKey });
  check(
    "نوبتِ قفل‌شده برای پرداخت، برای دیگران بسته است",
    !whileHeld.some((s) => s.time === holdSlot.time)
  );

  await prisma.appointment.update({
    where: { id: held.id },
    data: { holdExpiresAt: new Date(Date.now() - 60_000) },
  });
  const afterExpiry = await getAvailableSlots({ serviceId: service.id, dateKey });
  check(
    "قفل منقضی‌شده اسلات را آزاد می‌کند",
    afterExpiry.some((s) => s.time === holdSlot.time)
  );
  const released = await prisma.appointment.findUnique({ where: { id: held.id } });
  check("نوبت رهاشده خودکار لغو می‌شود", released?.status === "CANCELLED");

  // ── پکیج جلسات ──────────────────────────────────────────────
  const PKG_PHONE = "09125556677";
  await prisma.treatmentRecord.deleteMany({ where: { customer: { phone: PKG_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: PKG_PHONE } } });
  await prisma.package.deleteMany({ where: { customer: { phone: PKG_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: PKG_PHONE } });

  const pkgCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "پکیج", phone: PKG_PHONE },
  });
  const pkg = await prisma.package.create({
    data: {
      customerId: pkgCustomer.id,
      serviceId: service.id,
      title: "پکیج تست ۶ جلسه",
      totalSessions: 6,
      price: 9_000_000,
      paidAmount: 2_000_000,
    },
  });
  const addSession = (sessionNo: number, performedAt = new Date()) =>
    prisma.treatmentRecord.create({
      data: { customerId: pkgCustomer.id, serviceId: service.id, packageId: pkg.id, performedAt, sessionNo },
    });
  const pkgState = async () => (await summarizePackages(pkgCustomer.id)).find((p) => p.id === pkg.id)!;

  let ps = await pkgState();
  check(
    `پکیج تازه: ${ps.remainingSessions} جلسه و ${ps.remainingAmount} تومان مانده`,
    ps.usedSessions === 0 && ps.remainingSessions === 6 && ps.remainingAmount === 7_000_000
  );

  const s1 = await addSession(1);
  await addSession(2);
  await addSession(3);
  ps = await pkgState();
  check("شمارش جلسات پکیج از روی سابقه‌های واقعی", ps.usedSessions === 3 && ps.remainingSessions === 3);

  await prisma.treatmentRecord.delete({ where: { id: s1.id } });
  ps = await pkgState();
  check("حذف یک جلسه، باقی‌مانده‌ی پکیج را برمی‌گرداند", ps.usedSessions === 2 && ps.remainingSessions === 4);

  for (let i = 3; i <= 6; i++) await addSession(i);
  ps = await pkgState();
  check("پکیج پس از آخرین جلسه تمام‌شده می‌شود", ps.usedSessions === 6 && ps.remainingSessions === 0 && ps.isFinished);
  check("پکیج تمام‌شده در فهرست فعالِ مشتری نمی‌آید", (await activePackages(pkgCustomer.id)).length === 0);

  await addSession(7);
  ps = await pkgState();
  check("جلسه‌ی اضافه، باقی‌مانده را منفی نمی‌کند", ps.remainingSessions === 0);

  const expiredPkg = await prisma.package.create({
    data: {
      customerId: pkgCustomer.id,
      serviceId: service.id,
      title: "پکیج منقضی",
      totalSessions: 4,
      price: 4_000_000,
      paidAmount: 4_000_000,
      expiresAt: new Date(Date.now() - 86_400_000),
    },
  });
  const expiredState = (await summarizePackages(pkgCustomer.id)).find((p) => p.id === expiredPkg.id)!;
  check(
    "پکیج منقضی، نشانه‌گذاری و از فهرست فعال خارج می‌شود",
    expiredState.isExpired && !(await activePackages(pkgCustomer.id)).some((p) => p.id === expiredPkg.id)
  );

  await prisma.treatmentRecord.deleteMany({ where: { customerId: pkgCustomer.id } });
  await prisma.package.deleteMany({ where: { customerId: pkgCustomer.id } });
  await prisma.customer.delete({ where: { id: pkgCustomer.id } });

  // ── گزارش‌های مدیریتی ───────────────────────────────────────
  // بازه‌ای در گذشته‌ی دور انتخاب می‌کنیم تا داده‌ی واقعی کلینیک در آن نباشد
  const RP_PHONE = "09125554433";
  const rpFrom = new Date(2019, 0, 1, 0, 0, 0, 0);
  const rpTo = new Date(2019, 0, 31, 23, 59, 59, 999);
  const day = (d: number, h: number) => new Date(2019, 0, d, h, 0, 0, 0);

  await prisma.payment.deleteMany({ where: { customer: { phone: RP_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: RP_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: RP_PHONE } });

  const rpCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "گزارش", phone: RP_PHONE, createdAt: day(3, 9) },
  });
  const rpStaff = await prisma.staff.findFirstOrThrow();

  const makeAppt = async (d: number, h: number, status: "DONE" | "CANCELLED" | "CONFIRMED") =>
    prisma.appointment.create({
      data: {
        code: `SH-RP${d}${h}`,
        customerId: rpCustomer.id,
        serviceId: service.id,
        staffId: rpStaff.id,
        startsAt: day(d, h),
        endsAt: new Date(day(d, h).getTime() + 45 * 60_000),
        status,
        source: "smoke",
      },
    });

  const a1 = await makeAppt(5, 10, "DONE");
  const a2 = await makeAppt(9, 10, "DONE");
  await makeAppt(12, 16, "CANCELLED");
  await makeAppt(15, 11, "CONFIRMED"); // گذشته و هنوز تأیید‌شده ⇒ عدم مراجعه

  await prisma.payment.createMany({
    data: [
      { customerId: rpCustomer.id, appointmentId: a1.id, amount: 500_000, method: "CASH", status: "PAID", paidAt: day(5, 11) },
      { customerId: rpCustomer.id, appointmentId: a2.id, amount: 300_000, method: "CARD", status: "PAID", paidAt: day(9, 11) },
      { customerId: rpCustomer.id, amount: 1_000_000, method: "CARD", status: "PAID", paidAt: day(20, 12) },
      // این یکی نباید در درآمد بیاید
      { customerId: rpCustomer.id, amount: 999_000, method: "ONLINE", status: "PENDING", paidAt: null },
    ],
  });

  const report = await buildReport({ from: rpFrom, to: rpTo, label: "بازه‌ی تست" });

  check(
    `درآمد گزارش فقط از پرداخت‌های موفق (${report.revenue})`,
    report.revenue === 1_800_000 && report.paymentCount === 3
  );
  check(
    `تفکیک وضعیت نوبت‌ها (${report.appointments.done}/${report.appointments.cancelled}/${report.appointments.noShow})`,
    report.appointments.done === 2 &&
      report.appointments.cancelled === 1 &&
      report.appointments.noShow === 1 &&
      report.appointments.noShowRate === 25
  );
  const serviceRow = report.byService.find((r) => r.key === service.id);
  const looseRow = report.byService.find((r) => r.label.includes("بدون نوبت"));
  check(
    "درآمد به خدمتِ همان نوبت نسبت داده می‌شود",
    serviceRow?.revenue === 800_000 && serviceRow?.sessions === 2
  );
  check("پرداخت بدون نوبت جدا شمرده می‌شود", looseRow?.revenue === 1_000_000);
  check(
    "مشتری جدید و بازگشتی",
    report.customers.newCount === 1 &&
      report.customers.activeCount === 1 &&
      report.customers.returningCount === 0
  );
  check(
    "روش پرداخت تفکیک می‌شود",
    report.byMethod.find((m) => m.key === "CARD")?.revenue === 1_300_000 &&
      report.byMethod.find((m) => m.key === "CASH")?.revenue === 500_000
  );
  check("روند روزانه برای نمودار", report.daily.length === 3);

  await prisma.payment.deleteMany({ where: { customerId: rpCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: rpCustomer.id } });
  await prisma.customer.delete({ where: { id: rpCustomer.id } });

  await prisma.appointment.deleteMany({ where: { source: "smoke" } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: "09129998877" } } });
  await prisma.customer.deleteMany({ where: { phone: "09129998877" } });
  await prisma.$disconnect();

  console.log(failures === 0 ? "\n🎉 همه‌ی تست‌ها پاس شد." : `\n❌ ${failures} تست شکست خورد.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
