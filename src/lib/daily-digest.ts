import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { formatJalaliWithWeekday } from "./date";
import { formatToman, normalizePhone, toFa } from "./utils";
import { UNHAPPY_THRESHOLD } from "./feedback";
import { lowStockCount } from "./inventory";

export type DailyDigest = {
  date: Date;
  appointments: number;
  done: number;
  cancelled: number;
  noShow: number;
  newCustomers: number;
  revenue: number;
  unhappy: number;
  openFollowUps: number;
  tomorrow: number;
  waitlist: number;
  lowStock: number;
  /** متن آماده‌ی پیامک */
  message: string;
  /** اگر هیچ اتفاقی نیفتاده، ارزش پیامک‌دادن ندارد */
  isEmpty: boolean;
};

/** خلاصه‌ی یک روز کلینیک — برای پیامک شبانه به مدیر */
export async function buildDailyDigest(day = new Date()): Promise<DailyDigest> {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const tomorrowEnd = new Date(end);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const now = new Date();
  const settings = await getSettings();

  const [appointments, payments, newCustomers, unhappy, openFollowUps, tomorrow, waitlist, lowStock] =
    await Promise.all([
      prisma.appointment.findMany({
        where: { startsAt: { gte: start, lt: end } },
        select: { status: true, startsAt: true },
      }),
      prisma.payment.aggregate({
        where: { status: "PAID", paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      prisma.customer.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.feedback.count({
        where: {
          submittedAt: { gte: start, lt: end },
          rating: { lte: UNHAPPY_THRESHOLD },
        },
      }),
      prisma.followUp.count({ where: { status: "OPEN", dueAt: { lte: now } } }),
      prisma.appointment.count({
        where: { startsAt: { gte: end, lt: tomorrowEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
      }),
      prisma.waitlistEntry.count({ where: { status: "WAITING" } }),
      lowStockCount(),
    ]);

  const done = appointments.filter((a) => a.status === "DONE").length;
  const cancelled = appointments.filter((a) => a.status === "CANCELLED").length;
  // وقتش گذشته و هنوز انجام یا لغو نشده
  const noShow = appointments.filter(
    (a) => a.startsAt < now && (a.status === "PENDING" || a.status === "CONFIRMED"),
  ).length;
  const revenue = payments._sum.amount ?? 0;

  const lines = [
    `${settings.clinicName} — گزارش ${formatJalaliWithWeekday(start)}`,
    `نوبت: ${toFa(appointments.length)} | انجام: ${toFa(done)}` +
      (noShow > 0 ? ` | نیامد: ${toFa(noShow)}` : "") +
      (cancelled > 0 ? ` | لغو: ${toFa(cancelled)}` : ""),
    `دریافتی: ${formatToman(revenue)}`,
  ];

  if (newCustomers > 0) lines.push(`مشتری جدید: ${toFa(newCustomers)}`);
  if (unhappy > 0) lines.push(`⚠️ نظر ناراضی: ${toFa(unhappy)}`);
  if (openFollowUps > 0) lines.push(`پیگیری معوق: ${toFa(openFollowUps)}`);
  if (waitlist > 0) lines.push(`لیست انتظار: ${toFa(waitlist)}`);
  if (lowStock > 0) lines.push(`⚠️ ${toFa(lowStock)} قلم انبار رو به اتمام`);
  lines.push(`فردا: ${toFa(tomorrow)} نوبت`);

  return {
    date: start,
    appointments: appointments.length,
    done,
    cancelled,
    noShow,
    newCustomers,
    revenue,
    unhappy,
    openFollowUps,
    tomorrow,
    waitlist,
    lowStock,
    message: lines.join("\n"),
    isEmpty: appointments.length === 0 && revenue === 0 && tomorrow === 0 && unhappy === 0,
  };
}

/** شماره‌ای که گزارش شبانه به آن می‌رود — همان شکلی که واقعاً ارسال می‌شود */
export async function digestRecipient(): Promise<string> {
  const settings = await getSettings();
  const raw = (settings.managerPhone || settings.mobile || "").trim();
  return raw ? normalizePhone(raw) : "";
}
