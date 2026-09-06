import Link from "next/link";
import { ArrowRight, TriangleAlert, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { computePayroll } from "@/lib/payroll";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { jalaliMonthRange, formatJalaliLong } from "@/lib/date";
import { cn, formatToman, toFa } from "@/lib/utils";
import { TableScroll } from "@/components/admin/table-scroll";

export const dynamic = "force-dynamic";

export default async function MyEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await guardPage("payroll.own");
  const { month } = await searchParams;
  const offset = Math.max(-11, Math.min(0, Number(month) || 0));
  const range = jalaliMonthRange(offset);

  if (!user.staffId) {
    return (
      <>
        <AdminPageHeader title="درآمد من" />
        <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-500/5">
          <p className="flex items-start gap-3 text-sm leading-8">
            <TriangleAlert className="mt-1 size-5 shrink-0 text-amber-600" />
            حساب کاربری شما به هیچ پرسنلی متصل نیست. از مدیر کلینیک بخواهید این اتصال را برقرار کند.
          </p>
        </Card>
      </>
    );
  }

  const [computed, period] = await Promise.all([
    computePayroll(user.staffId, range.from, range.to),
    prisma.payrollPeriod.findUnique({
      where: { staffId_from_to: { staffId: user.staffId, from: range.from, to: range.to } },
    }),
  ]);

  const payable = period
    ? period.total
    : computed.baseSalary + computed.commissionAmount;

  return (
    <>
      <Link
        href="/admin/my"
        className="mb-5 inline-flex items-center gap-2 text-sm text-[color:var(--fg-muted)] transition-colors hover:text-rose-500"
      >
        <ArrowRight className="size-4" />
        بازگشت به نوبت‌های من
      </Link>

      <AdminPageHeader title="درآمد من" description={`دوره‌ی ${range.label}`} />

      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const o = -i;
          const r = jalaliMonthRange(o);
          return (
            <Link
              key={o}
              href={o === 0 ? "/admin/my/earnings" : `/admin/my/earnings?month=${o}`}
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
        <Stat label="جلسات انجام‌شده" value={toFa(computed.sessionCount)} />
        <Stat label="حقوق پایه" value={formatToman(computed.baseSalary)} />
        <Stat label="پورسانت" value={formatToman(computed.commissionAmount)} />
        <Stat label="جمع" value={formatToman(payable)} highlight />
      </div>

      {period ? (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              فیش این دوره صادر شده است.
              {period.bonus > 0 && ` پاداش: ${formatToman(period.bonus)}.`}
              {period.deduction > 0 && ` کسورات: ${formatToman(period.deduction)}.`}
            </p>
            {period.isPaid ? (
              <Badge tone="green">پرداخت شده</Badge>
            ) : (
              <Badge tone="amber">در انتظار پرداخت</Badge>
            )}
          </div>
          {period.note && (
            <p className="mt-3 rounded-2xl bg-[color:var(--bg-sunken)] p-3 text-xs leading-6">
              {period.note}
            </p>
          )}
        </Card>
      ) : (
        <Card className="mb-6">
          <p className="text-sm text-[color:var(--fg-muted)]">
            فیش این دوره هنوز صادر نشده. اعداد بالا محاسبه‌ی لحظه‌ای بر اساس جلسات انجام‌شده است.
          </p>
        </Card>
      )}

      {computed.lines.length === 0 ? (
        <EmptyState icon={Wallet} title="در این دوره جلسه‌ی انجام‌شده‌ای ندارید" />
      ) : (
        <Card padded={false}>
          <h2 className="border-b border-[color:var(--line)] p-4 sm:p-6 font-bold">
            ریز جلسات ({toFa(computed.lines.length)} مورد)
          </h2>
          <TableScroll>
            <table className="w-full min-w-[33rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">تاریخ</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">خدمت</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">مبلغ</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">درصد</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">سهم شما</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {computed.lines.map((line) => (
                  <tr key={line.appointmentId} className="transition-colors hover:bg-[color:var(--bg-sunken)]">
                    <td className="whitespace-nowrap px-3 sm:px-5 py-4 text-xs">{formatJalaliLong(line.date)}</td>
                    <td className="px-3 sm:px-5 py-4">
                      {line.serviceTitle}
                      <span className="block text-xs text-[color:var(--fg-muted)]">{line.customerName}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 sm:px-5 py-4">
                      {formatToman(line.amount, false)}
                      {line.estimated && (
                        <span className="mr-1.5 text-[10px] text-amber-600 dark:text-amber-300">تخمینی</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-5 py-4">{toFa(line.commissionPercent)}٪</td>
                    <td className="px-3 sm:px-5 py-4 font-bold text-rose-600 dark:text-rose-300">
                      {formatToman(line.commission, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <p className="text-xs text-[color:var(--fg-muted)]">{label}</p>
      <p className={cn("mt-2 text-lg font-extrabold", highlight && "text-rose-600 dark:text-rose-300")}>
        {value}
      </p>
    </Card>
  );
}
