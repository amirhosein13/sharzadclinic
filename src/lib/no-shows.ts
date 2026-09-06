import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { toFa } from "./utils";

/**
 * مشتری‌های بدقول.
 *
 * هر نوبتی که کسی نیاید، یک ساعتِ خالیِ پرداخت‌نشده است — پرسنل نشسته و
 * جای یک نفر دیگر هم گرفته شده. یک بار پیش می‌آید، ولی تکرارش را باید
 * دید. این‌جا فقط می‌شماریم و علامت می‌زنیم؛ تصمیمش با کلینیک است.
 */

export type NoShowRisk = "none" | "watch" | "high";

export type NoShowProfile = {
  /** کل نیامدن‌ها */
  total: number;
  /** نیامدن‌های پیاپیِ آخر — یعنی بعد از آخرین باری که واقعاً آمده */
  streak: number;
  /** آخرین باری که نیامد */
  lastAt: Date | null;
  risk: NoShowRisk;
  /** جمله‌ای که به منشی نشان داده می‌شود */
  message: string | null;
  /** آیا باید برای رزرو بعدی بیعانه گرفته شود */
  requiresDeposit: boolean;
};

const EMPTY: NoShowProfile = {
  total: 0,
  streak: 0,
  lastAt: null,
  risk: "none",
  message: null,
  requiresDeposit: false,
};

export async function noShowSettings(): Promise<{ watchAt: number; depositAt: number }> {
  const settings = await getSettings();
  const watchAt = Math.max(1, Number(settings.noShowWatchAfter) || 2);
  const depositAt = Math.max(watchAt, Number(settings.noShowDepositAfter) || 3);
  return { watchAt, depositAt };
}

/**
 * پرونده‌ی بدقولی یک مشتری.
 *
 * «پیاپی» یعنی از آخرین مراجعه‌ی واقعی‌اش به بعد؛ کسی که ده سال مشتری بوده
 * و دو بار نیامده، مثل کسی نیست که دو بار پشت‌سرهم نیامده باشد.
 */
export async function noShowProfile(customerId: string): Promise<NoShowProfile> {
  const { watchAt, depositAt } = await noShowSettings();

  // فقط نوبت‌های گذشته، از تازه به قدیم
  const history = await prisma.appointment.findMany({
    where: {
      customerId,
      startsAt: { lt: new Date() },
      status: { in: ["DONE", "NO_SHOW"] },
    },
    orderBy: { startsAt: "desc" },
    select: { status: true, startsAt: true },
    take: 50,
  });

  const total = history.filter((a) => a.status === "NO_SHOW").length;
  if (total === 0) return EMPTY;

  let streak = 0;
  for (const appt of history) {
    if (appt.status !== "NO_SHOW") break;
    streak++;
  }

  const lastAt = history.find((a) => a.status === "NO_SHOW")?.startsAt ?? null;
  const requiresDeposit = streak >= depositAt;
  const risk: NoShowRisk = requiresDeposit ? "high" : streak >= watchAt ? "watch" : "none";

  return {
    total,
    streak,
    lastAt,
    risk,
    requiresDeposit,
    message:
      risk === "none"
        ? null
        : requiresDeposit
          ? `${toFa(streak)} بار پشت‌سرهم نیامده است. برای این نوبت بیعانه بگیرید.`
          : `${toFa(streak)} بار پشت‌سرهم نیامده است. قبل از نوبت یک یادآوری تلفنی بدهید.`,
  };
}

export type NoShowRow = {
  customerId: string;
  name: string;
  phone: string;
  total: number;
  streak: number;
  lastAt: Date | null;
  risk: NoShowRisk;
  /** ارزش تقریبیِ وقت‌هایی که هدر رفته */
  wastedValue: number;
};

/**
 * فهرست بدقول‌ها برای مدیر — با تخمینی از پولی که این وقت‌ها می‌توانستند
 * بیاورند، تا معلوم شود موضوع چقدر جدی است.
 */
export async function noShowReport(months = 12): Promise<NoShowRow[]> {
  const { watchAt } = await noShowSettings();
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const noShows = await prisma.appointment.findMany({
    where: { status: "NO_SHOW", startsAt: { gte: since } },
    select: {
      customerId: true,
      customer: { select: { firstName: true, lastName: true, phone: true } },
      service: { select: { priceFrom: true } },
    },
  });

  if (noShows.length === 0) return [];

  const grouped = new Map<string, { name: string; phone: string; count: number; value: number }>();
  for (const row of noShows) {
    const current = grouped.get(row.customerId) ?? {
      name: `${row.customer.firstName} ${row.customer.lastName}`,
      phone: row.customer.phone,
      count: 0,
      value: 0,
    };
    current.count += 1;
    current.value += row.service?.priceFrom ?? 0;
    grouped.set(row.customerId, current);
  }

  // فقط کسانی که به مرز هشدار رسیده‌اند، وگرنه فهرست پر می‌شود از یک‌باری‌ها
  const candidates = [...grouped.entries()].filter(([, v]) => v.count >= watchAt);

  const rows = await Promise.all(
    candidates.map(async ([customerId, v]) => {
      const profile = await noShowProfile(customerId);
      return {
        customerId,
        name: v.name,
        phone: v.phone,
        total: v.count,
        streak: profile.streak,
        lastAt: profile.lastAt,
        risk: profile.risk,
        wastedValue: v.value,
      };
    }),
  );

  return rows.sort((a, b) => b.streak - a.streak || b.total - a.total);
}

/** جمع کل وقت‌های هدررفته در یک بازه — برای کارت گزارش */
export async function noShowCost(from: Date, to: Date): Promise<{ count: number; value: number }> {
  const rows = await prisma.appointment.findMany({
    where: { status: "NO_SHOW", startsAt: { gte: from, lte: to } },
    select: { service: { select: { priceFrom: true } } },
  });

  return {
    count: rows.length,
    value: rows.reduce((sum, r) => sum + (r.service?.priceFrom ?? 0), 0),
  };
}
