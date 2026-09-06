import "server-only";
import { prisma } from "./prisma";
import { formatJalaliLong, WEEKDAYS_FA } from "./date";

/**
 * «چرا وقت خالی نیست؟»
 *
 * وقتی کلینیک تعطیل است، مشتری فقط می‌دید «وقت خالی نیست» و فکر می‌کرد
 * کلینیک پر یا ورشکسته است. علتش را می‌گوییم و می‌گوییم از کِی دوباره
 * می‌شود نوبت گرفت.
 */

export type Closure = {
  from: Date;
  to: Date;
  reason: string | null;
  /** متنی که به مراجعه‌کننده نشان داده می‌شود */
  message: string;
};

/** تعطیلی‌های کل کلینیک که با امروز یا آینده‌ی نزدیک کار دارند */
export async function upcomingClosures(withinDays = 60): Promise<Closure[]> {
  const now = new Date();
  const until = new Date(now.getTime() + withinDays * 86_400_000);

  const rows = await prisma.timeOff.findMany({
    // staffId خالی یعنی تعطیلی کل کلینیک، نه مرخصی یک نفر
    where: { staffId: null, to: { gte: now }, from: { lte: until } },
    orderBy: { from: "asc" },
    select: { from: true, to: true, reason: true },
  });

  return rows.map((row) => {
    const sameDay = row.from.toDateString() === row.to.toDateString();
    const when = sameDay
      ? formatJalaliLong(row.from)
      : `${formatJalaliLong(row.from)} تا ${formatJalaliLong(row.to)}`;

    return {
      ...row,
      message: row.reason ? `${when} — ${row.reason}` : `${when} تعطیل است`,
    };
  });
}

/** آیا این لحظه کلینیک تعطیل است؟ */
export function activeClosure(closures: Closure[], at = new Date()): Closure | null {
  return closures.find((c) => c.from <= at && c.to >= at) ?? null;
}

/**
 * روزهایی که کلینیک اصلاً باز نیست — از روی ساعات کاری واقعی، نه یک متن
 * ثابت. اگر کلینیک روز تعطیلش را عوض کند، این جمله هم عوض می‌شود.
 */
export async function closedWeekdaysText(): Promise<string | null> {
  const hours = await prisma.workingHour.findMany({
    select: { weekday: true, isOpen: true },
    orderBy: { weekday: "asc" },
  });

  // اگر هنوز ساعت کاری تعریف نشده، ادعایی نمی‌کنیم
  if (hours.length === 0) return null;

  const closed = hours.filter((h) => !h.isOpen).map((h) => WEEKDAYS_FA[h.weekday]);
  if (closed.length === 0) return "کلینیک همه‌ی روزهای هفته باز است.";
  if (closed.length === hours.length) return null;

  const names = closed.length === 1 ? `${closed[0]}‌ها` : closed.join(" و ");
  return `${names} کلینیک تعطیل است.`;
}
