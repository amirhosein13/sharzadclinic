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
