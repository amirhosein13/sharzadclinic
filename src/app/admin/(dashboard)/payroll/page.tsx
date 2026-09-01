import Link from "next/link";
import { CircleCheck, TriangleAlert, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { computeAllPayroll, payrollTotal } from "@/lib/payroll";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { PayrollForm } from "@/components/admin/forms/payroll-form";
import { togglePayrollPaid } from "@/app/actions/payroll";
import { Badge } from "@/components/ui/badge";
import { jalaliMonthRange } from "@/lib/date";
import { cn, formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await guardPage("payroll");

  const { month } = await searchParams;
  const offset = Math.max(-11, Math.min(0, Number(month) || 0));
  const range = jalaliMonthRange(offset);

  const [computations, saved] = await Promise.all([
    computeAllPayroll(range.from, range.to),
    prisma.payrollPeriod.findMany({
      where: { from: range.from, to: range.to },
      include: { staff: { select: { name: true } } },
    }),
  ]);

  const savedByStaff = new Map(saved.map((p) => [p.staffId, p]));

  const totals = computations.reduce(
    (acc, c) => {
      const period = savedByStaff.get(c.staffId);
      acc.commission += c.commissionAmount;
      acc.base += c.baseSalary;
      acc.sessions += c.sessionCount;
      acc.payable += period
        ? period.total
        : payrollTotal({ ...c, bonus: 0, deduction: 0 });
      return acc;
    },
    { commission: 0, base: 0, sessions: 0, payable: 0 }
  );

  const estimatedTotal = computations.reduce((sum, c) => sum + c.estimatedCount, 0);

  return (
    <>
      <AdminPageHeader
        title="حقوق و دستمزد"
        description={`دوره‌ی ${range.label} — حقوق پایه به‌علاوه‌ی پورسانت جلسات انجام‌شده.`}
      />

      {/* انتخاب ماه */}
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const o = -i;
          const r = jalaliMonthRange(o);
          return (
            <Link
              key={o}
              href={o === 0 ? "/admin/payroll" : `/admin/payroll?month=${o}`}
              className={cn(
                "rounded-xl border px-4 py-2 text-xs font-medium transition-colors",
                offset === o
                  ? "border-rose-500 bg-rose-500 text-white"
                  : "border-[color:var(--line)] hover:border-rose-300 hover:text-rose-500"
              )}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="جلسات انجام‌شده" value={toFa(totals.sessions)} />
        <Stat label="مجموع حقوق پایه" value={formatToman(totals.base)} />
        <Stat label="مجموع پورسانت" value={formatToman(totals.commission)} />
        <Stat label="قابل پرداخت" value={formatToman(totals.payable)} highlight />
      </div>

      {estimatedTotal > 0 && (
        <Card className="mb-6 border-amber-300/60 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-500/5">
          <p className="flex items-start gap-3 text-sm leading-7">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <span>
              برای {toFa(estimatedTotal)} جلسه پرداختی ثبت نشده و مبلغشان از روی قیمت پایه‌ی خدمت
              <strong> تخمین </strong> زده شده است. برای محاسبه‌ی دقیق پورسانت، در صفحه‌ی نوبت‌ها
              مبلغ دریافتی هر جلسه را ثبت کنید.
            </span>
          </p>
        </Card>
      )}

      {computations.length === 0 ? (
        <EmptyState icon={Wallet} title="پرسنل فعالی ثبت نشده" />
      ) : (
        <div className="space-y-4">
          {computations.map((c) => {
            const period = savedByStaff.get(c.staffId);
            const payable = period ? period.total : payrollTotal({ ...c, bonus: 0, deduction: 0 });

            return (
              <Card key={c.staffId}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{c.staffName}</h2>
                      {period?.isPaid && (
                        <Badge tone="green">
                          <CircleCheck className="size-3" />
                          پرداخت شد
                        </Badge>
                      )}
                      {period && !period.isPaid && <Badge tone="amber">فیش صادر شده</Badge>}
                      {c.estimatedCount > 0 && (
                        <Badge tone="amber">{toFa(c.estimatedCount)} جلسه‌ی تخمینی</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-[color:var(--fg-muted)]">
                      {toFa(c.sessionCount)} جلسه • مبنای پورسانت {formatToman(c.commissionBase)}
                    </p>
                  </div>

                  <div className="text-left">
                    <p className="text-xs text-[color:var(--fg-muted)]">قابل پرداخت</p>
                    <p className="text-xl font-extrabold text-rose-600 dark:text-rose-300">
                      {formatToman(payable)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[color:var(--line)] pt-5 sm:grid-cols-4">
                  <Cell label="حقوق پایه" value={formatToman(c.baseSalary)} />
                  <Cell label="پورسانت" value={formatToman(c.commissionAmount)} />
                  <Cell label="پاداش" value={formatToman(period?.bonus ?? 0)} />
                  <Cell label="کسورات" value={formatToman(period?.deduction ?? 0)} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--line)] pt-5">
                  <PayrollForm
                    staffId={c.staffId}
                    staffName={c.staffName}
                    monthOffset={offset}
                    monthLabel={range.label}
                    computed={{
                      baseSalary: c.baseSalary,
                      commissionAmount: c.commissionAmount,
                      commissionBase: c.commissionBase,
                      sessionCount: c.sessionCount,
                    }}
                    saved={period ? { bonus: period.bonus, deduction: period.deduction, note: period.note } : undefined}
                    lines={c.lines.map((l) => ({
                      date: l.date.toISOString(),
                      serviceTitle: l.serviceTitle,
                      customerName: l.customerName,
                      amount: l.amount,
                      commissionPercent: l.commissionPercent,
                      commission: l.commission,
                      estimated: l.estimated,
                    }))}
                  />

                  {period && (
                    <ActionButton action={togglePayrollPaid.bind(null, period.id)}>
                      <CircleCheck className="size-3.5" />
                      {period.isPaid ? "برگرداندن به پرداخت‌نشده" : "علامت‌زدن پرداخت‌شده"}
                    </ActionButton>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <p className="text-xs text-[color:var(--fg-muted)]">{label}</p>
      <p
        className={cn(
          "mt-2 text-lg font-extrabold",
          highlight && "text-rose-600 dark:text-rose-300"
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--bg-sunken)] p-3 text-center">
      <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
