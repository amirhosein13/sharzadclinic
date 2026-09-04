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
import {
  notifyBirthday, notifyBookingReminder, notifyPostCare, notifyWinBack,
} from "../src/lib/notifications";
import { alreadyGreetedThisYear, birthdayMessage, todaysBirthdays } from "../src/lib/birthdays";
import { getSettings } from "../src/lib/settings";
import { generateFollowUps } from "../src/lib/followups";
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

/** فهرست پیگیری منشی را هم روزانه به‌روز می‌کند */
async function buildFollowUps() {
  const result = await generateFollowUps();
  const total = result.noShow + result.nextSession + result.postCare + result.winBack;
  if (total === 0) {
    console.log("\n🔎 پیگیری جدیدی لازم نبود.");
    return;
  }
  console.log(
    `\n🔎 ${toFa(total)} پیگیری جدید: ${toFa(result.noShow)} مراجعه‌نکرده، ` +
      `${toFa(result.nextSession)} جلسه‌ی بعد، ${toFa(result.postCare)} پس از درمان، ` +
      `${toFa(result.winBack)} بازگردانی.`
  );
}

/**
 * پیامک خودکار پیگیری — بارِ تماس گرفتن را از دوش منشی برمی‌دارد.
 * فقط برای پیگیری‌های بازی که هنوز پیامکی برایشان نرفته.
 */
async function sendFollowUpSms() {
  const settings = await getSettings();
  const postCareOn = settings.postCareSms === "1";
  const winBackOn = settings.winBackSms === "1";
  if (!postCareOn && !winBackOn) return;

  const kinds: ("POST_CARE" | "CUSTOM")[] = [];
  if (postCareOn) kinds.push("POST_CARE");
  if (winBackOn) kinds.push("CUSTOM");

  const items = await prisma.followUp.findMany({
    where: { status: "OPEN", kind: { in: kinds }, note: null },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true } },
      appointment: { include: { service: { select: { title: true } } } },
    },
    take: 100,
  });

  if (items.length === 0) return;
  console.log(`\n💬 ${toFa(items.length)} پیگیری آماده‌ی پیامک خودکار.`);

  const months = Number(settings.winBackAfterMonths) || 6;
  let sent = 0;

  for (const item of items) {
    const name = `${item.customer.firstName} ${item.customer.lastName}`;
    const result =
      item.kind === "POST_CARE"
        ? await notifyPostCare({
            phone: item.customer.phone,
            customerName: name,
            serviceTitle: item.appointment?.service.title ?? "درمان",
          })
        : await notifyWinBack({ phone: item.customer.phone, customerName: name, monthsAway: months });

    if (result.ok) {
      // note پر می‌شود تا دفعه‌ی بعد دوباره پیامک نرود
      await prisma.followUp.update({
        where: { id: item.id },
        data: { note: "پیامک خودکار ارسال شد" },
      });
      sent++;
      console.log(`  ✅ ${name}${result.simulated ? " (شبیه‌سازی)" : ""}`);
    } else {
      console.warn(`  ❌ ${name} — ${result.error ?? "ارسال ناموفق"}`);
    }
  }

  if (sent > 0) console.log(`   ${toFa(sent)} پیامک پیگیری ارسال شد.`);
}

/** تبریک تولد مشتریانی که امروز تولدشان است */
async function greetBirthdays() {
  const settings = await getSettings();
  if (settings.birthdaySms !== "1") return;

  const people = await todaysBirthdays();
  if (people.length === 0) {
    console.log("\n🎂 امروز تولد کسی نیست.");
    return;
  }

  console.log(`\n🎂 ${toFa(people.length)} نفر امروز تولدشان است.`);
  let sent = 0;
  for (const person of people) {
    // اگر امسال قبلاً تبریک رفته (مثلاً اسکریپت دوبار اجرا شده) دوباره نمی‌رود
    if (await alreadyGreetedThisYear(person.phone)) {
      console.log(`  ↷ ${person.name} — امسال تبریک رفته است`);
      continue;
    }
    const result = await notifyBirthday(person.phone, await birthdayMessage(person.name));
    if (result.ok) {
      sent++;
      console.log(`  ✅ ${person.name}${result.simulated ? " (شبیه‌سازی)" : ""}`);
    } else {
      console.warn(`  ❌ ${person.name} — ${result.error ?? "ارسال ناموفق"}`);
    }
  }
  if (sent > 0) console.log(`   ${toFa(sent)} تبریک ارسال شد.`);
}

main()
  .then(() => buildFollowUps())
  .then(() => sendFollowUpSms())
  .then(() => greetBirthdays())
  .catch((error) => {
    console.error("❌ خطا در ارسال یادآوری‌ها:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
