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
import { checkDiscount, normalizeCode, redeemDiscount } from "../src/lib/discounts";
import { joinWaitlist } from "../src/app/actions/waitlist";
import { matchesForSlot } from "../src/lib/waitlist";
import { submitFeedback } from "../src/app/actions/feedback";
import { buildSatisfaction, newFeedbackToken } from "../src/lib/feedback";
import { buildDailyDigest } from "../src/lib/daily-digest";
import { buildDaySchedule } from "../src/lib/day-schedule";
import { buildProfit } from "../src/lib/expenses";
import { openTicket, replyAsCustomer } from "../src/app/actions/tickets";
import { customerUnreadCount, isUrgent } from "../src/lib/tickets";
import { generateFollowUps } from "../src/lib/followups";
import { consumeForService, lowStockItems, recordMovement } from "../src/lib/inventory";

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

  // ── کد تخفیف ────────────────────────────────────────────────
  await prisma.discountUse.deleteMany({ where: { code: { code: { startsWith: "SMOKE" } } } });
  await prisma.discountCode.deleteMany({ where: { code: { startsWith: "SMOKE" } } });

  const dcCustomer = await prisma.customer.findFirstOrThrow();
  const dcOther = await prisma.customer.findFirstOrThrow({ where: { id: { not: dcCustomer.id } } });

  check("کد تخفیف یکدست می‌شود (فارسی و فاصله)", normalizeCode(" smoke۲۰ ") === "SMOKE20");

  const pct = await prisma.discountCode.create({
    data: {
      code: "SMOKE20",
      kind: "PERCENT",
      value: 20,
      maxDiscount: 100_000,
      minAmount: 200_000,
      maxUses: 2,
    },
  });
  const fixed = await prisma.discountCode.create({
    data: { code: "SMOKEFIX", kind: "FIXED", value: 500_000 },
  });
  const expiredCode = await prisma.discountCode.create({
    data: {
      code: "SMOKEOLD",
      kind: "FIXED",
      value: 50_000,
      expiresAt: new Date(Date.now() - 86_400_000),
    },
  });

  const below = await checkDiscount({ code: "smoke20", amount: 100_000 });
  check("کد زیر حداقل خرید رد می‌شود", !below.ok);

  const okPct = await checkDiscount({ code: "SMOKE20", amount: 300_000 });
  check(
    "تخفیف درصدی درست حساب می‌شود",
    okPct.ok && okPct.discount === 60_000 && okPct.finalAmount === 240_000
  );

  const capped = await checkDiscount({ code: "SMOKE20", amount: 2_000_000 });
  check("سقف تخفیف درصدی رعایت می‌شود", capped.ok && capped.discount === 100_000);

  const overFixed = await checkDiscount({ code: "SMOKEFIX", amount: 300_000 });
  check(
    "تخفیف ثابت از مبلغ خرید بیشتر نمی‌شود",
    overFixed.ok && overFixed.discount === 300_000 && overFixed.finalAmount === 0
  );

  const stale = await checkDiscount({ code: "SMOKEOLD", amount: 300_000 });
  check("کد منقضی‌شده رد می‌شود", !stale.ok);

  await redeemDiscount({ codeId: pct.id, customerId: dcCustomer.id, amount: 60_000 });
  const repeat = await checkDiscount({ code: "SMOKE20", amount: 300_000, customerId: dcCustomer.id });
  check("هر مشتری فقط یک بار از یک کد استفاده می‌کند", !repeat.ok);

  await redeemDiscount({ codeId: pct.id, customerId: dcOther.id, amount: 60_000 });
  const overCapacity = await redeemDiscount({
    codeId: pct.id,
    customerId: dcCustomer.id,
    amount: 60_000,
  });
  const afterUses = await prisma.discountCode.findUniqueOrThrow({ where: { id: pct.id } });
  check(
    "ظرفیت کل کد قابل دور زدن نیست",
    !overCapacity && afterUses.usedCount === 2
  );

  await prisma.discountUse.deleteMany({
    where: { codeId: { in: [pct.id, fixed.id, expiredCode.id] } },
  });
  await prisma.discountCode.deleteMany({ where: { code: { startsWith: "SMOKE" } } });

  // ── لیست انتظار ─────────────────────────────────────────────
  const WL_PHONE = "09125557788";
  await prisma.waitlistEntry.deleteMany({ where: { customer: { phone: WL_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: WL_PHONE } });

  const wlFromKey = dateKey;
  const wlTo = new Date(d);
  wlTo.setDate(wlTo.getDate() + 10);
  const wlToKey = `${wlTo.getFullYear()}-${String(wlTo.getMonth() + 1).padStart(2, "0")}-${String(wlTo.getDate()).padStart(2, "0")}`;

  const joined = await joinWaitlist(fd({
    serviceId: service.id,
    firstName: "تست",
    lastName: "انتظار",
    phone: "۰۹۱۲۵۵۵۷۷۸۸",
    fromDate: wlFromKey,
    toDate: wlToKey,
    note: "فقط عصرها",
  }));
  check("ثبت لیست انتظار از سایت", joined.ok);

  const wlCustomer = await prisma.customer.findUnique({ where: { phone: WL_PHONE } });
  check("مشتری تازه برای لیست انتظار ساخته شد", !!wlCustomer);

  const again = await joinWaitlist(fd({
    serviceId: service.id,
    firstName: "تست",
    lastName: "انتظار",
    phone: "09125557788",
    fromDate: wlFromKey,
    toDate: wlToKey,
  }));
  const wlCount = await prisma.waitlistEntry.count({ where: { customerId: wlCustomer!.id } });
  check(`درخواست تکراری دوباره ثبت نمی‌شود (${wlCount} درخواست)`, again.ok && wlCount === 1);

  const reversed = await joinWaitlist(fd({
    serviceId: service.id,
    firstName: "تست",
    lastName: "انتظار",
    phone: "09125557788",
    fromDate: wlToKey,
    toDate: wlFromKey,
  }));
  check("بازه‌ی برعکس رد می‌شود", !reversed.ok);

  const inRange = await matchesForSlot(service.id, atTime(parseYmdKey(wlFromKey), "12:00"));
  check(
    "منتظرانِ همان خدمت در همان بازه پیدا می‌شوند",
    inRange.some((e) => e.customerId === wlCustomer!.id)
  );

  const outOfRange = await matchesForSlot(service.id, new Date(wlTo.getTime() + 30 * 86_400_000));
  check(
    "خارج از بازه‌ی مشتری پیشنهاد نمی‌شود",
    !outOfRange.some((e) => e.customerId === wlCustomer!.id)
  );

  await prisma.waitlistEntry.deleteMany({ where: { customerId: wlCustomer!.id } });
  await prisma.customer.delete({ where: { id: wlCustomer!.id } });

  // ── نظرسنجی و گزارش رضایت ──────────────────────────────────
  const FB_PHONE = "09125552211";
  await prisma.feedback.deleteMany({ where: { customer: { phone: FB_PHONE } } });
  await prisma.followUp.deleteMany({ where: { customer: { phone: FB_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: FB_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: FB_PHONE } });

  const fbCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "نظر", phone: FB_PHONE },
  });
  const fbStaff = await prisma.staff.findFirstOrThrow();
  const fbFrom = new Date(Date.now() - 3 * 86_400_000);
  const fbTo = new Date(Date.now() + 86_400_000);

  const makeInvite = async (label: string) =>
    prisma.feedback.create({
      data: {
        customerId: fbCustomer.id,
        serviceId: service.id,
        staffId: fbStaff.id,
        token: newFeedbackToken(),
        sentAt: new Date(),
      },
      select: { id: true, token: true },
    }).then((row) => ({ ...row, label }));

  const happy = await makeInvite("راضی");
  const angry = await makeInvite("ناراضی");
  const untouched = await makeInvite("بی‌پاسخ");

  const happyResult = await submitFeedback(fd({
    token: happy.token,
    rating: "۵",
    comment: "خیلی راضی بودم",
    wouldRecommend: "yes",
    canPublish: "on",
  }));
  check("ثبت نظر با ارقام فارسی", happyResult.ok);

  // تگ‌ها به‌صورت چندمقداری فرستاده می‌شوند
  const angryForm = new FormData();
  angryForm.set("token", angry.token);
  angryForm.set("rating", "2");
  angryForm.append("badTags", "waiting");
  angryForm.append("badTags", "price");
  angryForm.append("badTags", "__hack__"); // کلید ناشناخته باید دور ریخته شود
  angryForm.append("goodTags", "staff");
  angryForm.append("goodTags", "waiting"); // تضاد: هم خوب هم بد
  angryForm.set("comment", "خیلی معطل شدم");
  angryForm.set("wouldRecommend", "no");
  const angryResult = await submitFeedback(angryForm);
  check("ثبت نظر منفی", angryResult.ok);

  const angryRow = await prisma.feedback.findUniqueOrThrow({ where: { id: angry.id } });
  check(
    "تگ ناشناخته ذخیره نمی‌شود",
    !angryRow.badTags.includes("__hack__") && angryRow.badTags.length === 2
  );
  check(
    "یک جنبه هم‌زمان خوب و بد نمی‌ماند",
    angryRow.goodTags.includes("staff") && !angryRow.goodTags.includes("waiting")
  );

  const duplicate = await submitFeedback(fd({ token: happy.token, rating: "4" }));
  check("نظر تکراری با همان لینک ثبت نمی‌شود", !duplicate.ok);

  const badToken = await submitFeedback(fd({ token: "0".repeat(32), rating: "4" }));
  check("لینک نامعتبر رد می‌شود", !badToken.ok);

  const autoFollowUp = await prisma.followUp.count({
    where: { customerId: fbCustomer.id, status: "OPEN" },
  });
  check(`نارضایتی خودکار به فهرست پیگیری می‌رود (${autoFollowUp})`, autoFollowUp === 1);

  const sat = await buildSatisfaction(fbFrom, fbTo);
  check(
    `میانگین رضایت درست است (${sat.averageRating} از ${sat.responses} نظر)`,
    sat.responses >= 2 && sat.averageRating > 0
  );
  check(
    "دعوت‌نامه‌ی بی‌پاسخ در میانگین نمی‌آید ولی در نرخ پاسخ شمرده می‌شود",
    sat.invitesSent >= 3 && sat.responseRate < 100
  );
  check(
    "پرتکرارترین شکایت‌ها استخراج می‌شود",
    sat.complaints.some((c) => c.key === "waiting") && sat.complaints.some((c) => c.key === "price")
  );
  check("نارضایتی باز شمرده می‌شود", sat.openComplaints >= 1);

  await prisma.followUp.deleteMany({ where: { customerId: fbCustomer.id } });
  await prisma.feedback.deleteMany({ where: { customerId: fbCustomer.id } });
  await prisma.customer.delete({ where: { id: fbCustomer.id } });
  void untouched;

  // ── گزارش شبانه و برنامه‌ی روز ──────────────────────────────
  // روزی در گذشته‌ی دور، تا داده‌ی واقعی کلینیک قاطی نشود
  const DG_PHONE = "09125559911";
  const dgDay = new Date(2019, 5, 10, 0, 0, 0, 0);
  const dgAt = (h: number, min = 0) => new Date(2019, 5, 10, h, min, 0, 0);

  await prisma.payment.deleteMany({ where: { customer: { phone: DG_PHONE } } });
  await prisma.feedback.deleteMany({ where: { customer: { phone: DG_PHONE } } });
  await prisma.followUp.deleteMany({ where: { customer: { phone: DG_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: DG_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: DG_PHONE } });

  const dgCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "گزارش‌شبانه", phone: DG_PHONE, createdAt: dgAt(9) },
  });
  const dgStaff = await prisma.staff.findFirstOrThrow();

  const dgAppt = async (h: number, status: "DONE" | "CANCELLED" | "CONFIRMED", code: string) =>
    prisma.appointment.create({
      data: {
        code,
        customerId: dgCustomer.id,
        serviceId: service.id,
        staffId: dgStaff.id,
        startsAt: dgAt(h),
        endsAt: dgAt(h, 45),
        status,
        source: "smoke",
      },
    });

  const dgDone = await dgAppt(10, "DONE", "SH-DG01");
  await dgAppt(12, "DONE", "SH-DG02");
  await dgAppt(14, "CANCELLED", "SH-DG03");
  await dgAppt(16, "CONFIRMED", "SH-DG04"); // گذشته و تعیین‌تکلیف نشده ⇒ نیامد

  await prisma.payment.create({
    data: {
      customerId: dgCustomer.id,
      appointmentId: dgDone.id,
      amount: 850_000,
      method: "CARD",
      status: "PAID",
      paidAt: dgAt(11),
    },
  });
  await prisma.feedback.create({
    data: {
      customerId: dgCustomer.id,
      serviceId: service.id,
      token: newFeedbackToken(),
      rating: 2,
      goodTags: [],
      badTags: ["waiting"],
      status: "SUBMITTED",
      sentAt: dgAt(17),
      submittedAt: dgAt(18),
    },
  });

  const digest = await buildDailyDigest(dgDay);
  check(
    `گزارش شبانه: شمارش نوبت‌ها (${digest.appointments}/${digest.done}/${digest.noShow}/${digest.cancelled})`,
    digest.appointments === 4 && digest.done === 2 && digest.noShow === 1 && digest.cancelled === 1
  );
  check(`گزارش شبانه: دریافتی (${digest.revenue})`, digest.revenue === 850_000);
  check("گزارش شبانه: مشتری جدید و نظر ناراضی", digest.newCustomers === 1 && digest.unhappy === 1);
  check(
    "متن پیامک همه‌ی بخش‌ها را دارد",
    digest.message.includes("نوبت:") &&
      digest.message.includes("دریافتی:") &&
      digest.message.includes("نظر ناراضی") &&
      digest.message.includes("فردا:") &&
      !digest.isEmpty
  );

  const emptyDigest = await buildDailyDigest(new Date(2018, 0, 15));
  check("روز خالی پیامک نمی‌گیرد", emptyDigest.isEmpty);

  // برنامه‌ی روز، همان داده را ستون‌بندی می‌کند
  const board = await buildDaySchedule("2019-06-10");
  const dgColumn = board.columns.find((c) => c.staffId === dgStaff.id);
  check(
    `برنامه‌ی روز، نوبت‌ها را زیر پرسنل می‌چیند (${dgColumn?.blocks.length ?? 0})`,
    dgColumn?.blocks.length === 4
  );
  check(
    "بلوک‌ها ساعت درست دارند",
    dgColumn?.blocks[0]?.startMinute === 600 && dgColumn?.blocks[0]?.endMinute === 645
  );
  check(
    "بازه‌ی نمایش، همه‌ی نوبت‌ها را در بر می‌گیرد",
    board.fromMinute <= 600 && board.toMinute >= 16 * 60 + 45
  );

  await prisma.payment.deleteMany({ where: { customerId: dgCustomer.id } });
  await prisma.feedback.deleteMany({ where: { customerId: dgCustomer.id } });
  await prisma.followUp.deleteMany({ where: { customerId: dgCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: dgCustomer.id } });
  await prisma.customer.delete({ where: { id: dgCustomer.id } });

  // ── انبار، هزینه و سود ──────────────────────────────────────
  await prisma.serviceMaterial.deleteMany({ where: { item: { name: { startsWith: "تست‌کالا" } } } });
  await prisma.expense.deleteMany({ where: { title: { contains: "تست‌کالا" } } });
  await prisma.stockMovement.deleteMany({ where: { item: { name: { startsWith: "تست‌کالا" } } } });
  await prisma.inventoryItem.deleteMany({ where: { name: { startsWith: "تست‌کالا" } } });

  const item = await prisma.inventoryItem.create({
    data: { name: "تست‌کالا ژل", unit: "سی‌سی", minStock: 3, unitCost: 0 },
  });

  // خرید: موجودی بالا می‌رود، بهای واحد به‌روز می‌شود و هزینه ثبت می‌گردد
  await recordMovement({ itemId: item.id, kind: "IN", quantity: 10, unitCost: 200_000 });
  let stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`خرید انبار موجودی و بهای واحد را به‌روز می‌کند (${stock.stock})`, stock.stock === 10 && stock.unitCost === 200_000);

  const autoExpense = await prisma.expense.findFirst({
    where: { title: { contains: "تست‌کالا" } },
    include: { category: { select: { slug: true } } },
  });
  check(
    `خرید انبار خودکار هزینه ثبت می‌کند (${autoExpense?.amount})`,
    autoExpense?.amount === 2_000_000 && autoExpense.category.slug === "materials"
  );

  await recordMovement({ itemId: item.id, kind: "OUT", quantity: 2.5 });
  stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`مصرف از موجودی کم می‌کند (${stock.stock})`, stock.stock === 7.5);

  // مصرف بیشتر از موجودی نباید منفی شود
  await recordMovement({ itemId: item.id, kind: "OUT", quantity: 100 });
  stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`موجودی منفی نمی‌شود (${stock.stock})`, stock.stock === 0);

  // اصلاح شمارش: عدد واردشده موجودیِ نهایی است
  await recordMovement({ itemId: item.id, kind: "ADJUST", quantity: 0, absoluteStock: 4 });
  stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`اصلاح شمارش موجودی را روی عدد واقعی می‌گذارد (${stock.stock})`, stock.stock === 4);

  // بالای مرز هشدار (۴ > ۳) نباید هشدار بدهد
  const notLow = await lowStockItems();
  check("بالای مرز هشدار، هشداری داده نمی‌شود", !notLow.some((i) => i.id === item.id));

  // مصرف خودکار خدمت
  await prisma.serviceMaterial.create({ data: { serviceId: service.id, itemId: item.id, quantity: 1.5 } });
  const consumed = await consumeForService(service.id, "smoke-treatment-1");
  stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`مصرف خودکار خدمت از انبار کم می‌کند (${stock.stock})`, consumed === 1 && stock.stock === 2.5);

  // حالا زیر مرز است (۲.۵ ≤ ۳) و باید هشدار بدهد
  const lows = await lowStockItems();
  check("زیر مرز هشدار، قلم در فهرست کمبود می‌آید", lows.some((i) => i.id === item.id));

  // ── سود، روی داده‌ی کنترل‌شده ───────────────────────────────
  const PR_PHONE = "09125553311";
  const prFrom = new Date(2017, 2, 1, 0, 0, 0, 0);
  const prTo = new Date(2017, 2, 31, 23, 59, 59, 999);
  const prAt = (d: number) => new Date(2017, 2, d, 11, 0, 0, 0);

  await prisma.payment.deleteMany({ where: { customer: { phone: PR_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: PR_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: PR_PHONE } });
  await prisma.expense.deleteMany({ where: { spentAt: { gte: prFrom, lte: prTo } } });

  const prCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "سود", phone: PR_PHONE },
  });
  const prStaff = await prisma.staff.findFirstOrThrow();
  // درصد پورسانت واقعی می‌گذاریم تا این بخشِ تست تهی نباشد
  const prevCommission = prStaff.commissionPercent;
  await prisma.staff.update({ where: { id: prStaff.id }, data: { commissionPercent: 20 } });
  await prisma.staffOnService.updateMany({
    where: { staffId: prStaff.id, serviceId: service.id },
    data: { commissionPercent: null },
  });
  const prAppt = await prisma.appointment.create({
    data: {
      code: "SH-PR01",
      customerId: prCustomer.id,
      serviceId: service.id,
      staffId: prStaff.id,
      startsAt: prAt(5),
      endsAt: new Date(prAt(5).getTime() + 45 * 60_000),
      status: "DONE",
      source: "smoke",
    },
  });
  await prisma.payment.create({
    data: {
      customerId: prCustomer.id,
      appointmentId: prAppt.id,
      amount: 1_000_000,
      method: "CASH",
      status: "PAID",
      paidAt: prAt(5),
    },
  });

  const rentCategory = await prisma.expenseCategory.findUniqueOrThrow({ where: { slug: "rent" } });
  await prisma.expense.create({
    data: { categoryId: rentCategory.id, title: "اجاره تست", amount: 400_000, spentAt: prAt(1) },
  });

  const profit = await buildProfit(prFrom, prTo);
  check(
    `سود = درآمد منهای هزینه (${profit.revenue} − ${profit.expenses} = ${profit.profit})`,
    profit.revenue === 1_000_000 && profit.expenses === 400_000 && profit.profit === 600_000
  );
  check(`حاشیه‌ی سود (${profit.margin}٪)`, profit.margin === 60);

  const profitRow = profit.byService.find((r) => r.serviceId === service.id);
  // ۱.۵ سی‌سی × ۲۰۰٬۰۰۰ = ۳۰۰٬۰۰۰ بهای مواد
  check(
    `بهای مواد هر جلسه در سود خدمت می‌آید (${profitRow?.materialCost})`,
    profitRow?.materialCost === 300_000 && profitRow.missingMaterials === false
  );
  check(
    `پورسانت ۲۰٪ در سود خدمت کم می‌شود (${profitRow?.commission})`,
    profitRow?.commission === 200_000
  );
  check(
    `سود خدمت = درآمد − مواد − پورسانت (${profitRow?.profit})`,
    profitRow?.profit === 1_000_000 - 300_000 - 200_000
  );

  await prisma.staff.update({ where: { id: prStaff.id }, data: { commissionPercent: prevCommission } });

  await prisma.serviceMaterial.deleteMany({ where: { itemId: item.id } });
  await prisma.expense.deleteMany({ where: { stockMovementId: { not: null } } });
  await prisma.stockMovement.deleteMany({ where: { itemId: item.id } });
  await prisma.inventoryItem.delete({ where: { id: item.id } });
  await prisma.payment.deleteMany({ where: { customerId: prCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: prCustomer.id } });
  await prisma.customer.delete({ where: { id: prCustomer.id } });
  await prisma.expense.deleteMany({ where: { spentAt: { gte: prFrom, lte: prTo } } });

  // ── پیگیری خودکار: پس از درمان و بازگردانی ──────────────────
  const FU_PHONE = "09125554477";
  await prisma.followUp.deleteMany({ where: { customer: { phone: FU_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: FU_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: FU_PHONE } });

  const fuCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "پیگیری", phone: FU_PHONE },
  });
  const fuStaff = await prisma.staff.findFirstOrThrow();
  const prevFollowUpDays = service.followUpDays;
  await prisma.service.update({ where: { id: service.id }, data: { followUpDays: 3 } });

  // جلسه‌ای که ۳ روز پیش انجام شده ⇒ باید پیگیری پس از درمان بسازد
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(11, 0, 0, 0);
  await prisma.appointment.create({
    data: {
      code: "SH-FU01",
      customerId: fuCustomer.id,
      serviceId: service.id,
      staffId: fuStaff.id,
      startsAt: threeDaysAgo,
      endsAt: new Date(threeDaysAgo.getTime() + 45 * 60_000),
      status: "DONE",
      source: "smoke",
    },
  });

  const fu1 = await generateFollowUps();
  const postCareRows = await prisma.followUp.count({
    where: { customerId: fuCustomer.id, kind: "POST_CARE" },
  });
  check(`پیگیری پس از درمان ساخته شد (${fu1.postCare})`, postCareRows === 1);

  // اجرای دوباره نباید تکراری بسازد
  await generateFollowUps();
  const afterSecond = await prisma.followUp.count({
    where: { customerId: fuCustomer.id, kind: "POST_CARE" },
  });
  check("پیگیری پس از درمان تکراری ساخته نمی‌شود", afterSecond === 1);

  await prisma.service.update({ where: { id: service.id }, data: { followUpDays: prevFollowUpDays } });
  await prisma.followUp.deleteMany({ where: { customerId: fuCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: fuCustomer.id } });
  await prisma.customer.delete({ where: { id: fuCustomer.id } });

  // ── تیکت ────────────────────────────────────────────────────
  const TK_PHONE = "09125556644";
  await prisma.supportTicket.deleteMany({ where: { customer: { phone: TK_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: TK_PHONE } });

  const tkCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "تیکت", phone: TK_PHONE },
  });

  // بدون ورود مشتری نباید بشود تیکت باز کرد
  const anonymous = await openTicket(fd({ subject: "تست", category: "other", body: "سلام سلام" }));
  check("بدون ورود، تیکت باز نمی‌شود", !anonymous.ok);

  const ticket = await prisma.supportTicket.create({
    data: {
      customerId: tkCustomer.id,
      subject: "سؤال درباره‌ی مراقبت",
      category: "aftercare",
      messages: { create: { sender: "CUSTOMER", body: "بعد از لیزر می‌توانم استخر بروم؟" } },
    },
  });
  check(
    "تیکت تازه منتظر پاسخ ماست",
    ticket.status === "OPEN" && ticket.unreadByStaff && !ticket.unreadByCustomer
  );

  // پاسخ کارکنان به نشست ادمین نیاز دارد و در تست مرورگر بررسی می‌شود؛
  // این‌جا فقط چیزهایی را می‌سنجیم که به نشست وابسته نیستند.
  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId: ticket.id, sender: "STAFF", body: "تا ۴۸ ساعت بهتر است نروید." },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "ANSWERED", lastSender: "STAFF", unreadByStaff: false, unreadByCustomer: true },
    }),
  ]);

  check(
    "شمارنده‌ی «منتظر پاسخ ما» تیکتِ پاسخ‌داده‌شده را نمی‌شمارد",
    !(await prisma.supportTicket.findMany({ where: { unreadByStaff: true, status: { not: "CLOSED" } } }))
      .some((t) => t.id === ticket.id)
  );
  check("شمارنده‌ی خوانده‌نشده‌ی مشتری", (await customerUnreadCount(tkCustomer.id)) === 1);
  check("شکایتِ باز فوری علامت می‌خورد", isUrgent("complaint", "OPEN") && !isUrgent("other", "OPEN"));

  const messageCount = await prisma.ticketMessage.count({ where: { ticketId: ticket.id } });
  check(`گفت‌وگو دو پیام دارد (${messageCount})`, messageCount === 2);

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  // مشتری در گفت‌وگوی بسته نباید بتواند بنویسد
  const closedReply = await replyAsCustomer(fd({ ticketId: ticket.id, body: "یک سؤال دیگر" }));
  check("در گفت‌وگوی بسته پاسخ ثبت نمی‌شود", !closedReply.ok);

  await prisma.supportTicket.deleteMany({ where: { customerId: tkCustomer.id } });
  await prisma.customer.delete({ where: { id: tkCustomer.id } });

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
