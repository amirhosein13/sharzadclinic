import "server-only";
import { addDays, differenceInCalendarDays, getDate, getDaysInMonth, startOfDay } from "date-fns-jalali";
import type { DutyRepeat, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { jalaliWeekday } from "./date";

/**
 * ───────────────────────────────────────────────────────────────
 *  مسئولیت‌های پرسنل و کارهای هر روز
 * ───────────────────────────────────────────────────────────────
 *
 *  «مسئولیت» قاعده است و «کار» نمونه‌ی آن در یک روز مشخص. این فایل
 *  پل بین آن دوست: از روی مسئولیت‌های فعال، کارهای امروز را می‌سازد.
 *
 *  درسی که از کارتابل پیگیری گرفتیم و اینجا از اول اعمال شده:
 *  کارتابلی که فقط اضافه می‌کند و هیچ‌وقت چیزی را بیرون نمی‌برد،
 *  بعد از دو ماه ۷۴۵ موردی می‌شود و کسی نگاهش نمی‌کند. پس هر کاری
 *  که ساخته می‌شود، راه خروج هم دارد: یا تیک می‌خورد، یا بعد از
 *  مهلتِ معقولِ خودش خودکار بسته می‌شود.
 */

/** نیمه‌شبِ محلیِ همان روز — کلید یکتایی کارها همین است */
export function dayKey(date: Date = new Date()): Date {
  return startOfDay(date);
}

/**
 * مهلتِ هر نوع مسئولیت: بعد از چند روز، کارِ انجام‌نشده دیگر
 * «عقب‌افتاده» نیست و فقط شلوغی است.
 *
 * «صندوق را ببند» مربوط به سه‌شنبه، روز پنجشنبه هنوز قابل دیدن است
 * (مدیر باید بفهمد انجام نشده) ولی دو هفته بعد معنایی ندارد.
 */
const GRACE_DAYS: Record<DutyRepeat, number> = {
  DAILY: 2,
  WEEKLY: 7,
  MONTHLY: 30,
};

/** بازه‌ای که کارهای عقب‌افتاده در آن نشان داده می‌شوند */
export const OVERDUE_WINDOW_DAYS = 30;

export type DutyRule = {
  repeat: DutyRepeat;
  weekdays: number[];
  monthDay: number | null;
};

/**
 * آیا این مسئولیت برای این روز است؟
 *
 * نکته‌ی ماهانه: اگر مدیر روز ۳۱ را انتخاب کند، ماه‌های ۳۰ روزه و
 * اسفندِ ۲۹ روزه آن مسئولیت را هیچ‌وقت اجرا نمی‌کردند. پس روزِ
 * انتخابی به آخرین روز ماه محدود می‌شود تا هیچ ماهی از قلم نیفتد.
 */
export function dutyMatchesDay(duty: DutyRule, day: Date): boolean {
  switch (duty.repeat) {
    case "DAILY":
      return true;
    case "WEEKLY":
      return duty.weekdays.includes(jalaliWeekday(day));
    case "MONTHLY": {
      if (!duty.monthDay) return false;
      const target = Math.min(duty.monthDay, getDaysInMonth(day));
      return getDate(day) === target;
    }
    default:
      return false;
  }
}

/**
 * کارهای یک روز را می‌سازد. چند بار صدا زدنش بی‌خطر است — قید یکتای
 * (dutyId, dueOn) کار تکراری را رد می‌کند.
 *
 * عمداً برای روزهای گذشته چیزی نمی‌سازد: اگر کسی تاریخ قدیمی را باز
 * کند، نباید تاریخِ نداشته برایش جعل شود.
 */
export async function ensureTasksForDay(
  day: Date = new Date(),
  assigneeId?: string,
): Promise<number> {
  const due = dayKey(day);
  if (due < dayKey()) return 0;

  const duties = await prisma.duty.findMany({
    where: {
      isActive: true,
      // حساب غیرفعال نباید کار تازه بگیرد
      assignee: { isActive: true },
      ...(assigneeId ? { assigneeId } : {}),
    },
    select: {
      id: true,
      title: true,
      note: true,
      repeat: true,
      weekdays: true,
      monthDay: true,
      assigneeId: true,
      createdById: true,
    },
  });

  const dueToday = duties.filter((duty) => dutyMatchesDay(duty, due));
  if (dueToday.length === 0) return 0;

  const existing = await prisma.task.findMany({
    where: { dueOn: due, dutyId: { in: dueToday.map((d) => d.id) } },
    select: { dutyId: true },
  });
  const already = new Set(existing.map((t) => t.dutyId));

  const missing = dueToday.filter((d) => !already.has(d.id));
  if (missing.length === 0) return 0;

  const result = await prisma.task.createMany({
    data: missing.map((duty) => ({
      dutyId: duty.id,
      title: duty.title,
      note: duty.note,
      assigneeId: duty.assigneeId,
      createdById: duty.createdById,
      dueOn: due,
    })),
    // دو درخواست هم‌زمان (دو کارمند که با هم صفحه را باز می‌کنند)
    // نباید یکی‌شان خطا بدهد
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * کارهای کهنه‌ی انجام‌نشده را می‌بندد.
 *
 * ⚠️ عمداً doneAt را ست نمی‌کند. در کارتابل پیگیری همین اشتباه را
 * کردیم و شمارنده‌ی «امروز انجام شد» عدد ۳۳۵ نشان داد، در حالی که
 * کسی هیچ‌کاری نکرده بود. بستنِ خودکار «انجام‌شده» نیست.
 *
 * کارهای دستیِ مدیر (که dutyId ندارند) هیچ‌وقت خودکار بسته نمی‌شوند:
 * آن‌ها را کسی با قصد سپرده و فقط خودش باید ببندد.
 */
export async function retireStaleTasks(today: Date = new Date()): Promise<number> {
  const base = dayKey(today);

  const clauses: Prisma.TaskWhereInput[] = Object.entries(GRACE_DAYS).map(
    ([repeat, grace]) => ({
      duty: { repeat: repeat as DutyRepeat },
      dueOn: { lt: addDays(base, -grace) },
    }),
  );

  const result = await prisma.task.updateMany({
    where: { status: "OPEN", OR: clauses },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

/** کارهای امروز و عقب‌افتاده‌ی یک کارمند، بعد از ساخت و پاک‌سازی */
export async function tasksForUser(userId: string, today: Date = new Date()) {
  const base = dayKey(today);

  // ترتیب مهم است: اول کهنه‌ها بسته شوند، بعد امروز ساخته شود، تا
  // کارِ تازه‌ساخته‌ی امروز قربانی پاک‌سازی نشود.
  await retireStaleTasks(base);
  await ensureTasksForDay(base, userId);

  const [today_, overdue] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId, dueOn: base },
      include: { duty: { select: { timeHint: true, repeat: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: "OPEN",
        dueOn: { lt: base, gte: addDays(base, -OVERDUE_WINDOW_DAYS) },
      },
      include: { duty: { select: { timeHint: true, repeat: true } } },
      orderBy: { dueOn: "asc" },
    }),
  ]);

  return { today: today_, overdue };
}

/**
 * پیشرفت امروزِ همه‌ی کارمندان — برای صفحه‌ی مدیر.
 *
 * کارهای همه ساخته می‌شود، نه فقط کسی که آمده. وگرنه مدیر صبح نگاه
 * می‌کند و «هیچ کاری نیست» می‌بیند، چون کارمند هنوز وارد نشده.
 */
export async function todayProgress(today: Date = new Date()) {
  const base = dayKey(today);
  await retireStaleTasks(base);
  await ensureTasksForDay(base);

  const rows = await prisma.task.groupBy({
    by: ["assigneeId", "status"],
    where: { dueOn: base },
    _count: { _all: true },
  });

  const overdue = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: { status: "OPEN", dueOn: { lt: base, gte: addDays(base, -OVERDUE_WINDOW_DAYS) } },
    _count: { _all: true },
  });

  const byUser = new Map<string, { done: number; open: number; overdue: number }>();
  const slot = (id: string) => {
    const found = byUser.get(id) ?? { done: 0, open: 0, overdue: 0 };
    byUser.set(id, found);
    return found;
  };

  for (const row of rows) {
    const entry = slot(row.assigneeId);
    if (row.status === "DONE") entry.done += row._count._all;
    else if (row.status === "OPEN") entry.open += row._count._all;
  }
  for (const row of overdue) slot(row.assigneeId).overdue += row._count._all;

  return byUser;
}

/**
 * چند کار بازِ خودِ کاربر — بَج کنار منو.
 *
 * مثل teamOverdueCount فقط می‌خواند. ساختِ کارهای امروز کارِ صفحه‌ی
 * «کارهای امروز» است، نه layout؛ وگرنه هر بار هر صفحه‌ای باز شود
 * یک رفت‌وبرگشتِ نوشتن به دیتابیس اضافه می‌شود.
 */
export async function openTaskCount(userId: string, today: Date = new Date()): Promise<number> {
  const base = dayKey(today);
  return prisma.task.count({
    where: {
      assigneeId: userId,
      status: "OPEN",
      dueOn: { lte: base, gte: addDays(base, -OVERDUE_WINDOW_DAYS) },
    },
  });
}

/**
 * کارهای عقب‌افتاده‌ی کل تیم — بَجِ کنار «مسئولیت‌ها» برای مدیر.
 *
 * عمداً هیچ کاری نمی‌سازد و هیچ‌چیز را نمی‌بندد: این تابع در
 * layout و روی *هر* صفحه‌ی پنل اجرا می‌شود، پس باید فقط بخواند.
 */
export async function teamOverdueCount(today: Date = new Date()): Promise<number> {
  const base = dayKey(today);
  return prisma.task.count({
    where: { status: "OPEN", dueOn: { lt: base, gte: addDays(base, -OVERDUE_WINDOW_DAYS) } },
  });
}

/** «۳ روز عقب» برای نمایش کنار کار عقب‌افتاده */
export function daysLate(dueOn: Date, today: Date = new Date()): number {
  return Math.max(0, differenceInCalendarDays(dayKey(today), dayKey(dueOn)));
}

export const REPEAT_LABELS: Record<DutyRepeat, string> = {
  DAILY: "هر روز",
  WEEKLY: "هفتگی",
  MONTHLY: "ماهانه",
};
