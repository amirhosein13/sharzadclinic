import "server-only";
import { prisma } from "./prisma";
import { atTime, parseYmdKey } from "./date";
import type { PaymentMethod } from "@prisma/client";

/**
 * بستن صندوق آخر شب.
 *
 * سیستم می‌گوید امروز چقدر باید گرفته باشیم و به چه شکلی؛ کاربر پول توی
 * کشو را می‌شمارد و عدد واقعی را می‌زند. اختلاف همان شب معلوم می‌شود، نه
 * آخر ماه که دیگر هیچ‌کس یادش نیست.
 */

export type CashLine = {
  method: PaymentMethod;
  label: string;
  amount: number;
  count: number;
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "نقدی",
  CARD: "کارت‌خوان",
  ONLINE: "آنلاین",
  OTHER: "سایر",
};

export type CashDay = {
  dateKey: string;
  day: Date;
  lines: CashLine[];
  /** جمع همه‌ی روش‌ها */
  total: number;
  /** فقط نقدی */
  expectedCash: number;
  /** هزینه‌هایی که از صندوق پرداخت شده‌اند */
  cashExpenses: number;
  cashExpenseRows: { id: string; title: string; amount: number }[];
  /** نقدیِ انتظار پس از کسر هزینه‌ها — عددی که باید در کشو باشد */
  expectedInDrawer: number;
  /** اگر این روز قبلاً بسته شده */
  closed: {
    countedCash: number;
    difference: number;
    note: string | null;
    closedAt: Date;
    closedBy: string | null;
    expectedInDrawer: number;
  } | null;
};

function dayBounds(dateKey: string): { from: Date; to: Date; day: Date } {
  const day = parseYmdKey(dateKey);
  return { day, from: atTime(day, "00:00"), to: atTime(day, "23:59") };
}

export async function buildCashDay(dateKey: string): Promise<CashDay> {
  const { day, from, to } = dayBounds(dateKey);

  const [payments, expenses, close] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      where: { status: "PAID", paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expense.findMany({
      where: { paidFromCash: true, spentAt: { gte: from, lte: to } },
      select: { id: true, title: true, amount: true },
      orderBy: { amount: "desc" },
    }),
    prisma.cashClose.findUnique({
      where: { day: from },
      include: { closedBy: { select: { name: true } } },
    }),
  ]);

  const byMethod = new Map(payments.map((p) => [p.method, p]));
  const lines: CashLine[] = (["CASH", "CARD", "ONLINE", "OTHER"] as PaymentMethod[]).map(
    (method) => ({
      method,
      label: METHOD_LABELS[method],
      amount: byMethod.get(method)?._sum.amount ?? 0,
      count: byMethod.get(method)?._count._all ?? 0,
    }),
  );

  const expectedCash = lines.find((l) => l.method === "CASH")?.amount ?? 0;
  const cashExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    dateKey,
    day,
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
    expectedCash,
    cashExpenses,
    cashExpenseRows: expenses,
    expectedInDrawer: expectedCash - cashExpenses,
    closed: close
      ? {
          countedCash: close.countedCash,
          difference: close.difference,
          note: close.note,
          closedAt: close.closedAt,
          closedBy: close.closedBy?.name ?? null,
          expectedInDrawer: close.expectedCash - close.cashExpenses,
        }
      : null,
  };
}

export type CloseResult = { ok: true; difference: number } | { ok: false; message: string };

/**
 * ثبت شمارش کشو. اگر همان روز قبلاً بسته شده باشد، بازنویسی می‌شود تا
 * اشتباه تایپی قابل اصلاح باشد — ولی هر بار در گزارش فعالیت می‌نشیند.
 */
export async function closeCashDay(options: {
  dateKey: string;
  countedCash: number;
  note?: string | null;
  userId?: string | null;
}): Promise<CloseResult> {
  if (!Number.isFinite(options.countedCash) || options.countedCash < 0) {
    return { ok: false, message: "مبلغ شمرده‌شده را درست وارد کنید." };
  }

  const { from } = dayBounds(options.dateKey);
  if (from.getTime() > Date.now()) {
    return { ok: false, message: "روزی که هنوز نیامده را نمی‌شود بست." };
  }

  const day = await buildCashDay(options.dateKey);
  const difference = options.countedCash - day.expectedInDrawer;

  const data = {
    expectedCash: day.expectedCash,
    expectedCard: day.lines.find((l) => l.method === "CARD")?.amount ?? 0,
    expectedOnline: day.lines.find((l) => l.method === "ONLINE")?.amount ?? 0,
    expectedOther: day.lines.find((l) => l.method === "OTHER")?.amount ?? 0,
    cashExpenses: day.cashExpenses,
    countedCash: options.countedCash,
    difference,
    note: options.note?.trim() || null,
    closedById: options.userId ?? null,
    closedAt: new Date(),
  };

  await prisma.cashClose.upsert({
    where: { day: from },
    create: { day: from, ...data },
    update: data,
  });

  return { ok: true, difference };
}

export type CloseHistoryRow = {
  id: string;
  dateKey: string;
  day: Date;
  countedCash: number;
  expectedInDrawer: number;
  difference: number;
  cardTotal: number;
  onlineTotal: number;
  note: string | null;
  closedBy: string | null;
};

export async function recentCloses(limit = 30): Promise<CloseHistoryRow[]> {
  const rows = await prisma.cashClose.findMany({
    orderBy: { day: "desc" },
    take: limit,
    include: { closedBy: { select: { name: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    dateKey: `${r.day.getFullYear()}-${String(r.day.getMonth() + 1).padStart(2, "0")}-${String(r.day.getDate()).padStart(2, "0")}`,
    day: r.day,
    countedCash: r.countedCash,
    expectedInDrawer: r.expectedCash - r.cashExpenses,
    difference: r.difference,
    cardTotal: r.expectedCard,
    onlineTotal: r.expectedOnline,
    note: r.note,
    closedBy: r.closedBy?.name ?? null,
  }));
}

/**
 * روزهایی که پول گرفته شده ولی صندوق بسته نشده — تا یک روز از قلم نیفتد.
 * امروز حساب نمی‌شود، چون هنوز تمام نشده.
 */
export async function unclosedDays(lookbackDays = 14): Promise<string[]> {
  const now = new Date();
  const start = atTime(new Date(now.getTime() - lookbackDays * 86_400_000), "00:00");
  const todayStart = atTime(now, "00:00");

  const [payments, closes] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: start, lt: todayStart } },
      select: { paidAt: true },
    }),
    prisma.cashClose.findMany({
      where: { day: { gte: start, lt: todayStart } },
      select: { day: true },
    }),
  ]);

  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const closed = new Set(closes.map((c) => keyOf(c.day)));
  const withMoney = new Set(
    payments.map((p) => keyOf(p.paidAt!)).filter((key) => !closed.has(key)),
  );

  return [...withMoney].sort().reverse();
}
