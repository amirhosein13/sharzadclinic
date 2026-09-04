import "server-only";
import { prisma } from "./prisma";
import {
  formatJalali, jalaliMonthRange, jalaliWeekday, jalaliYearRange, WEEKDAYS_FA,
} from "./date";

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "نقدی",
  CARD: "کارت‌خوان",
  ONLINE: "آنلاین",
  OTHER: "سایر",
};

export type ReportRange = { from: Date; to: Date; label: string };

export type Breakdown = {
  key: string;
  label: string;
  sessions: number;
  revenue: number;
};

/** مقایسه با دوره‌ی قبلیِ هم‌اندازه */
export type Comparison = {
  revenue: number;
  sessions: number;
  newCustomers: number;
  /** درصد تغییر نسبت به دوره‌ی قبل؛ null یعنی دوره‌ی قبل صفر بوده */
  revenueChange: number | null;
  sessionsChange: number | null;
  newCustomersChange: number | null;
  label: string;
};

export type ReportData = {
  range: ReportRange;
  previous: Comparison | null;
  revenue: number;
  paymentCount: number;
  /** میانگین مبلغ هر پرداخت */
  averageTicket: number;
  appointments: {
    total: number;
    done: number;
    cancelled: number;
    /** گذشته ولی هنوز تأیید/انجام نشده — یعنی نیامده یا ثبت نشده */
    noShow: number;
    upcoming: number;
    noShowRate: number;
  };
  customers: {
    newCount: number;
    activeCount: number;
    returningCount: number;
    returningRate: number;
  };
  byService: Breakdown[];
  byStaff: Breakdown[];
  byMethod: { key: string; label: string; count: number; revenue: number }[];
  byWeekday: { label: string; sessions: number }[];
  byHour: { hour: number; sessions: number }[];
  topCustomers: {
    id: string;
    name: string;
    phone: string;
    visits: number;
    spent: number;
  }[];
  daily: { dateKey: string; label: string; revenue: number; sessions: number }[];
};

const NO_APPOINTMENT = "__none__";

function sortByRevenue(rows: Breakdown[]): Breakdown[] {
  return rows.sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);
}

/**
 * همه‌ی اعداد گزارش در یک بازه. درآمد فقط از پرداخت‌های موفق شمرده می‌شود
 * و به نوبتِ متصل به آن پرداخت نسبت داده می‌شود؛ پرداخت‌های بدون نوبت
 * (مثل قسط پکیج) جداگانه زیر «بدون نوبت» می‌آیند.
 */
export async function buildReport(range: ReportRange): Promise<ReportData> {
  const { from, to } = range;
  const now = new Date();

  const [payments, appointments, newCustomers, priorCustomerIds] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: from, lte: to } },
      select: {
        amount: true,
        method: true,
        paidAt: true,
        customerId: true,
        appointment: {
          select: {
            id: true,
            serviceId: true,
            staffId: true,
            service: { select: { title: true } },
            staff: { select: { name: true } },
          },
        },
      },
    }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: from, lte: to } },
      select: {
        id: true,
        status: true,
        startsAt: true,
        serviceId: true,
        staffId: true,
        customerId: true,
        service: { select: { title: true } },
        staff: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.appointment
      .findMany({
        where: { startsAt: { lt: from }, status: "DONE" },
        select: { customerId: true },
        distinct: ["customerId"],
      })
      .then((rows) => new Set(rows.map((r) => r.customerId))),
  ]);

  const revenue = payments.reduce((sum, p) => sum + p.amount, 0);

  // دوره‌ی قبلیِ هم‌اندازه، درست پیش از این بازه
  const previous = await comparePrevious(range, {
    revenue,
    sessions: appointments.filter((a) => a.status === "DONE").length,
    newCustomers,
  });

  /* ── نوبت‌ها ─────────────────────────────────────────────── */
  const done = appointments.filter((a) => a.status === "DONE").length;
  const cancelled = appointments.filter((a) => a.status === "CANCELLED").length;
  const upcoming = appointments.filter(
    (a) => a.startsAt >= now && (a.status === "PENDING" || a.status === "CONFIRMED"),
  ).length;
  const noShow = appointments.filter(
    (a) => a.startsAt < now && (a.status === "PENDING" || a.status === "CONFIRMED"),
  ).length;
  // نوبت‌های آینده هنوز سرنوشتشان معلوم نیست و در مخرج نمی‌آیند
  const settled = done + cancelled + noShow;

  /* ── تفکیک خدمت و پرسنل ─────────────────────────────────── */
  const services = new Map<string, Breakdown>();
  const staff = new Map<string, Breakdown>();
  const touch = (map: Map<string, Breakdown>, key: string, label: string) => {
    let row = map.get(key);
    if (!row) {
      row = { key, label, sessions: 0, revenue: 0 };
      map.set(key, row);
    }
    return row;
  };

  for (const a of appointments) {
    if (a.status !== "DONE") continue;
    touch(services, a.serviceId, a.service.title).sessions++;
    touch(staff, a.staffId ?? NO_APPOINTMENT, a.staff?.name ?? "بدون پرسنل").sessions++;
  }

  for (const p of payments) {
    const appt = p.appointment;
    if (appt) {
      touch(services, appt.serviceId, appt.service.title).revenue += p.amount;
      touch(staff, appt.staffId ?? NO_APPOINTMENT, appt.staff?.name ?? "بدون پرسنل").revenue += p.amount;
    } else {
      touch(services, NO_APPOINTMENT, "بدون نوبت (پکیج و متفرقه)").revenue += p.amount;
      touch(staff, NO_APPOINTMENT, "بدون پرسنل").revenue += p.amount;
    }
  }

  /* ── روش پرداخت ─────────────────────────────────────────── */
  const methods = new Map<string, { key: string; label: string; count: number; revenue: number }>();
  for (const p of payments) {
    let row = methods.get(p.method);
    if (!row) {
      row = { key: p.method, label: PAYMENT_METHOD_LABELS[p.method] ?? p.method, count: 0, revenue: 0 };
      methods.set(p.method, row);
    }
    row.count++;
    row.revenue += p.amount;
  }

  /* ── روز هفته و ساعت ────────────────────────────────────── */
  const byWeekday = WEEKDAYS_FA.map((label) => ({ label, sessions: 0 }));
  const hours = new Map<number, number>();
  for (const a of appointments) {
    if (a.status === "CANCELLED") continue;
    byWeekday[jalaliWeekday(a.startsAt)].sessions++;
    hours.set(a.startsAt.getHours(), (hours.get(a.startsAt.getHours()) ?? 0) + 1);
  }
  const byHour = [...hours.entries()]
    .map(([hour, sessions]) => ({ hour, sessions }))
    .sort((a, b) => a.hour - b.hour);

  /* ── مشتریان ────────────────────────────────────────────── */
  const activeIds = new Set(appointments.map((a) => a.customerId));
  const returningCount = [...activeIds].filter((id) => priorCustomerIds.has(id)).length;

  const spentByCustomer = new Map<string, number>();
  for (const p of payments) {
    spentByCustomer.set(p.customerId, (spentByCustomer.get(p.customerId) ?? 0) + p.amount);
  }
  const visitsByCustomer = new Map<string, { visits: number; name: string; phone: string }>();
  for (const a of appointments) {
    if (a.status !== "DONE") continue;
    const row = visitsByCustomer.get(a.customerId) ?? {
      visits: 0,
      name: `${a.customer.firstName} ${a.customer.lastName}`,
      phone: a.customer.phone,
    };
    row.visits++;
    visitsByCustomer.set(a.customerId, row);
  }
  const topCustomers = [...visitsByCustomer.entries()]
    .map(([id, row]) => ({ id, ...row, spent: spentByCustomer.get(id) ?? 0 }))
    .sort((a, b) => b.spent - a.spent || b.visits - a.visits)
    .slice(0, 10);

  /* ── روند روزانه ────────────────────────────────────────── */
  const dailyMap = new Map<string, { revenue: number; sessions: number }>();
  const bump = (date: Date, patch: Partial<{ revenue: number; sessions: number }>) => {
    const key = formatJalali(date, "yyyy/MM/dd");
    const row = dailyMap.get(key) ?? { revenue: 0, sessions: 0 };
    row.revenue += patch.revenue ?? 0;
    row.sessions += patch.sessions ?? 0;
    dailyMap.set(key, row);
  };
  for (const p of payments) if (p.paidAt) bump(p.paidAt, { revenue: p.amount });
  for (const a of appointments) if (a.status === "DONE") bump(a.startsAt, { sessions: 1 });

  const daily = [...dailyMap.entries()]
    .map(([dateKey, row]) => ({ dateKey, label: dateKey, ...row }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return {
    range,
    previous,
    revenue,
    paymentCount: payments.length,
    averageTicket: payments.length ? Math.round(revenue / payments.length) : 0,
    appointments: {
      total: appointments.length,
      done,
      cancelled,
      noShow,
      upcoming,
      noShowRate: settled ? Math.round((noShow / settled) * 100) : 0,
    },
    customers: {
      newCount: newCustomers,
      activeCount: activeIds.size,
      returningCount,
      returningRate: activeIds.size ? Math.round((returningCount / activeIds.size) * 100) : 0,
    },
    byService: sortByRevenue([...services.values()]),
    byStaff: sortByRevenue([...staff.values()]),
    byMethod: [...methods.values()].sort((a, b) => b.revenue - a.revenue),
    byWeekday,
    byHour,
    topCustomers,
    daily,
  };
}

/* ── بازه‌های آماده ─────────────────────────────────────────── */

export const RANGE_PRESETS = [
  { key: "this-month", label: "این ماه" },
  { key: "last-month", label: "ماه گذشته" },
  { key: "last-3", label: "۳ ماه اخیر" },
  { key: "last-6", label: "۶ ماه اخیر" },
  { key: "this-year", label: "امسال" },
  { key: "all", label: "از ابتدا" },
] as const;

export type RangeKey = (typeof RANGE_PRESETS)[number]["key"];

export function isRangeKey(value: string | undefined): value is RangeKey {
  return !!value && RANGE_PRESETS.some((p) => p.key === value);
}

export function resolveRange(key: RangeKey): ReportRange {
  const thisMonth = jalaliMonthRange(0);

  switch (key) {
    case "last-month": {
      const m = jalaliMonthRange(-1);
      return { from: m.from, to: m.to, label: m.label };
    }
    case "last-3": {
      const start = jalaliMonthRange(-2);
      return { from: start.from, to: thisMonth.to, label: `${start.label} تا ${thisMonth.label}` };
    }
    case "last-6": {
      const start = jalaliMonthRange(-5);
      return { from: start.from, to: thisMonth.to, label: `${start.label} تا ${thisMonth.label}` };
    }
    case "this-year": {
      const y = jalaliYearRange();
      return { from: y.from, to: y.to, label: y.label };
    }
    case "all":
      return { from: new Date(2000, 0, 1), to: new Date(2100, 0, 1), label: "از ابتدا تا امروز" };
    case "this-month":
    default:
      return { from: thisMonth.from, to: thisMonth.to, label: thisMonth.label };
  }
}

const changeOf = (now: number, before: number): number | null =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

/**
 * همان بازه، ولی درست قبلش. «۱۲٪ بیشتر از ماه قبل» خیلی گویاتر از یک
 * عدد خالی است. اگر بازه از ابتدای تاریخ باشد، مقایسه معنی ندارد.
 */
async function comparePrevious(
  range: ReportRange,
  current: { revenue: number; sessions: number; newCustomers: number },
): Promise<Comparison | null> {
  const span = range.to.getTime() - range.from.getTime();
  // بازه‌ی «از ابتدا» دوره‌ی قبلی ندارد
  if (span <= 0 || span > 400 * 86_400_000) return null;

  const prevTo = new Date(range.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);

  const [payments, sessions, newCustomers] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "PAID", paidAt: { gte: prevFrom, lte: prevTo } },
      _sum: { amount: true },
    }),
    prisma.appointment.count({
      where: { status: "DONE", startsAt: { gte: prevFrom, lte: prevTo } },
    }),
    prisma.customer.count({ where: { createdAt: { gte: prevFrom, lte: prevTo } } }),
  ]);

  const revenue = payments._sum.amount ?? 0;

  return {
    revenue,
    sessions,
    newCustomers,
    revenueChange: changeOf(current.revenue, revenue),
    sessionsChange: changeOf(current.sessions, sessions),
    newCustomersChange: changeOf(current.newCustomers, newCustomers),
    label: `${formatJalali(prevFrom)} تا ${formatJalali(prevTo)}`,
  };
}
