/**
 * تست دودی (smoke test) مسیر رزرو نوبت — بدون نیاز به مرورگر.
 * اجرا:  npm run test:smoke
 * دیتای تستی ساخته و در پایان پاک می‌شود.
 */
import { PrismaClient } from "@prisma/client";
import { getAvailableSlots } from "../src/lib/availability";
import { createBooking, trackAppointment } from "../src/app/actions/booking";

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
