import Link from "next/link";
import { Lock, Receipt, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { ExpenseForm } from "@/components/admin/forms/expense-form";
import { deleteExpense } from "@/app/actions/finance";
import { summarizeExpenses } from "@/lib/expenses";
import { isRangeKey, RANGE_PRESETS, resolveRange } from "@/lib/reports";
import { formatJalaliLong, toJalaliInput } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await guardPage("payroll");

  const { range: rangeParam } = await searchParams;
  const rangeKey = isRangeKey(rangeParam) ? rangeParam : "this-month";
  const range = resolveRange(rangeKey);

  const [expenses, summary, categories, staff] = await Promise.all([
    prisma.expense.findMany({
      where: { spentAt: { gte: range.from, lte: range.to } },
      include: {
        category: { select: { title: true } },
        staff: { select: { name: true } },
      },
      orderBy: { spentAt: "desc" },
      take: 200,
    }),
    summarizeExpenses(range.from, range.to),
    prisma.expenseCategory.findMany({ where: { isSystem: false }, orderBy: { order: "asc" } }),
    prisma.staff.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { order: "asc" } }),
  ]);

  const maxCategory = Math.max(1, ...summary.byCategory.map((c) => c.amount));

  return (
    <>
      <AdminPageHeader
        title="هزینه‌ها"
        description={`${range.label} — مجموع ${formatToman(summary.total)} در ${toFa(expenses.length)} قلم`}
        action={
          <ExpenseForm
            categories={categories}
            staff={staff}
            todayJalali={toJalaliInput(new Date())}
          />
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGE_PRESETS.map((preset) => (
          <Link
            key={preset.key}
            href={`/admin/expenses?range=${preset.key}`}
            className={
              preset.key === rangeKey
                ? "rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white"
                : "rounded-xl border border-[color:var(--line)] px-4 py-2 text-sm transition-colors hover:bg-[color:var(--bg-sunken)]"
            }
          >
            {preset.label}
          </Link>
        ))}
      </div>

      {summary.byCategory.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-5 font-bold">به تفکیک دسته</h2>
          <ul className="space-y-4">
            {summary.byCategory.map((row) => (
              <li key={row.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">
                    {row.title}
                    <span className="mr-1.5 text-xs text-[color:var(--fg-muted)]">
                      ({toFa(row.count)} قلم)
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">{formatToman(row.amount)}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-600"
                    style={{ width: `${Math.max(Math.round((row.amount / maxCategory) * 100), 4)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {expenses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="در این بازه هزینه‌ای ثبت نشده"
            description="اجاره، حقوق، قبض‌ها و خریدها را این‌جا وارد کنید تا گزارش سود واقعی شود."
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-[color:var(--line)]">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {expense.title}
                    {expense.stockMovementId && (
                      <span
                        title="از خرید انبار آمده"
                        className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--bg-sunken)] px-2 py-0.5 text-[11px] text-[color:var(--fg-muted)]"
                      >
                        <Lock className="size-3" />
                        انبار
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                    {expense.category.title} • {formatJalaliLong(expense.spentAt)}
                    {expense.staff && ` • ${expense.staff.name}`}
                  </p>
                  {expense.note && (
                    <p className="mt-1.5 text-xs text-[color:var(--fg-muted)]">{expense.note}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold">{formatToman(expense.amount)}</span>
                  {!expense.stockMovementId && (
                    <div className="flex gap-2">
                      <ExpenseForm
                        categories={categories}
                        staff={staff}
                        todayJalali={toJalaliInput(new Date())}
                        expense={{
                          id: expense.id,
                          categoryId: expense.categoryId,
                          staffId: expense.staffId,
                          title: expense.title,
                          amount: expense.amount,
                          spentAt: toJalaliInput(expense.spentAt),
                          note: expense.note,
                        }}
                      />
                      <ActionButton
                        action={deleteExpense.bind(null, expense.id)}
                        confirm="این هزینه حذف شود؟"
                        title="حذف"
                        className="size-8 p-0 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </ActionButton>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
