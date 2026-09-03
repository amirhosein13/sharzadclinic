import "server-only";
import { prisma } from "./prisma";
import { materialCostByService } from "./inventory";

/** دسته‌های پیش‌فرض هزینه — با seed ساخته می‌شوند */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { slug: "rent", title: "اجاره و شارژ", order: 1 },
  { slug: "salary", title: "حقوق و دستمزد", order: 2 },
  { slug: "materials", title: "مواد مصرفی", order: 3, isSystem: true },
  { slug: "utilities", title: "قبوض (برق، آب، گاز، اینترنت)", order: 4 },
  { slug: "equipment", title: "دستگاه و تعمیرات", order: 5 },
  { slug: "marketing", title: "تبلیغات", order: 6 },
  { slug: "tax", title: "مالیات و بیمه", order: 7 },
  { slug: "other", title: "سایر", order: 8 },
] as const;

export type ExpenseSummary = {
  total: number;
  byCategory: { id: string; title: string; slug: string; amount: number; count: number }[];
};

export async function summarizeExpenses(from: Date, to: Date): Promise<ExpenseSummary> {
  const rows = await prisma.expense.findMany({
    where: { spentAt: { gte: from, lte: to } },
    include: { category: { select: { id: true, title: true, slug: true } } },
  });

  const map = new Map<string, { id: string; title: string; slug: string; amount: number; count: number }>();
  for (const row of rows) {
    const current = map.get(row.categoryId) ?? {
      id: row.category.id,
      title: row.category.title,
      slug: row.category.slug,
      amount: 0,
      count: 0,
    };
    current.amount += row.amount;
    current.count++;
    map.set(row.categoryId, current);
  }

  return {
    total: rows.reduce((sum, r) => sum + r.amount, 0),
    byCategory: [...map.values()].sort((a, b) => b.amount - a.amount),
  };
}

export type ProfitReport = {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  expensesByCategory: ExpenseSummary["byCategory"];
  /** سود هر خدمت: درآمد منهای بهای مواد و پورسانت */
  byService: {
    serviceId: string;
    title: string;
    sessions: number;
    revenue: number;
    materialCost: number;
    commission: number;
    profit: number;
    /** هیچ ماده‌ای برای این خدمت تعریف نشده، پس بهای مواد صفر فرض شده */
    missingMaterials: boolean;
  }[];
};

/**
 * سود واقعی در یک بازه.
 *
 * درآمد از پرداخت‌های موفق، هزینه از دفتر هزینه. سودِ هر خدمت جداگانه هم
 * حساب می‌شود: درآمدِ آن خدمت منهای بهای موادش و پورسانت پرسنل. اگر برای
 * خدمتی ماده‌ای تعریف نشده باشد، صادقانه علامت می‌خورد تا کسی عدد را
 * اشتباه نخواند.
 */
export async function buildProfit(from: Date, to: Date): Promise<ProfitReport> {
  const [payments, doneAppointments, expenses, materialCosts, staffList] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: from, lte: to } },
      select: {
        amount: true,
        appointment: {
          select: { serviceId: true, staffId: true, service: { select: { title: true } } },
        },
      },
    }),
    prisma.appointment.findMany({
      where: { status: "DONE", startsAt: { gte: from, lte: to } },
      select: { serviceId: true, staffId: true, service: { select: { title: true } } },
    }),
    summarizeExpenses(from, to),
    materialCostByService(),
    prisma.staff.findMany({
      select: {
        id: true,
        commissionPercent: true,
        services: { select: { serviceId: true, commissionPercent: true } },
      },
    }),
  ]);

  const revenue = payments.reduce((sum, p) => sum + p.amount, 0);

  const commissionFor = (staffId: string | null, serviceId: string, amount: number) => {
    if (!staffId) return 0;
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return 0;
    const override = staff.services.find((s) => s.serviceId === serviceId)?.commissionPercent;
    const percent = override ?? staff.commissionPercent ?? 0;
    return Math.round((amount * percent) / 100);
  };

  type Row = ProfitReport["byService"][number];
  const rows = new Map<string, Row>();
  const touch = (serviceId: string, title: string): Row => {
    let row = rows.get(serviceId);
    if (!row) {
      row = {
        serviceId,
        title,
        sessions: 0,
        revenue: 0,
        materialCost: 0,
        commission: 0,
        profit: 0,
        missingMaterials: !materialCosts.has(serviceId),
      };
      rows.set(serviceId, row);
    }
    return row;
  };

  for (const appt of doneAppointments) {
    const row = touch(appt.serviceId, appt.service.title);
    row.sessions++;
    row.materialCost += materialCosts.get(appt.serviceId) ?? 0;
  }

  for (const payment of payments) {
    const appt = payment.appointment;
    if (!appt) continue;
    const row = touch(appt.serviceId, appt.service.title);
    row.revenue += payment.amount;
    row.commission += commissionFor(appt.staffId, appt.serviceId, payment.amount);
  }

  const byService = [...rows.values()]
    .map((row) => ({
      ...row,
      materialCost: Math.round(row.materialCost),
      profit: Math.round(row.revenue - row.materialCost - row.commission),
    }))
    .sort((a, b) => b.profit - a.profit);

  const profit = revenue - expenses.total;

  return {
    revenue,
    expenses: expenses.total,
    profit,
    margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    expensesByCategory: expenses.byCategory,
    byService,
  };
}
