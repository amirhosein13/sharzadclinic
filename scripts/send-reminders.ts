/**
 * ارسال پیامک یادآوری برای نوبت‌های فردا.
 *
 * اجرا:  npm run reminders
 *
 * روی سرور با cron هر روز صبح اجرا کن، مثلاً ساعت ۱۰:
 *   0 10 * * *  cd /path/to/app && npm run reminders >> /var/log/sharzad-reminders.log 2>&1
 *
 * اسکریپت idempotent است: هر نوبت فقط یک بار یادآوری می‌گیرد
 * (فیلد reminderSentAt).
 */
import "../src/lib/timezone";
import { PrismaClient } from "@prisma/client";
import { notifyBookingReminder } from "../src/lib/notifications";
import { formatJalaliWithWeekday } from "../src/lib/date";
import { toFa } from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  console.log(`🔔 یادآوری نوبت‌های ${formatJalaliWithWeekday(start)}\n`);

  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: start, lt: end },
      status: { in: ["PENDING", "CONFIRMED"] },
      reminderSentAt: null,
    },
    include: { customer: true, service: true },
    orderBy: { startsAt: "asc" },
  });

  if (appointments.length === 0) {
    console.log("نوبتی برای یادآوری وجود ندارد.");
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const appointment of appointments) {
    const name = `${appointment.customer.firstName} ${appointment.customer.lastName}`;
    const result = await notifyBookingReminder({
      phone: appointment.customer.phone,
      customerName: name,
      serviceTitle: appointment.service.title,
      startsAt: appointment.startsAt,
    });

    if (result.ok) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
      console.log(`  ✅ ${name} — ${appointment.service.title}${result.simulated ? " (شبیه‌سازی)" : ""}`);
    } else {
      failed++;
      console.warn(`  ❌ ${name} — ${result.error ?? "ارسال ناموفق"}`);
    }
  }

  console.log(
    `\n📊 ${toFa(sent)} ارسال موفق، ${toFa(failed)} ناموفق، از ${toFa(appointments.length)} نوبت.`
  );
}

main()
  .catch((error) => {
    console.error("❌ خطا در ارسال یادآوری‌ها:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
