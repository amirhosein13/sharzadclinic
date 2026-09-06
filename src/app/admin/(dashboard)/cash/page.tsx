import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, TriangleAlert, Wallet } from "lucide-react";
import { guardPage } from "@/lib/guard";
import { getSession } from "@/lib/auth";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { CashCloseForm } from "@/components/admin/cash-close-form";
import { ActionButton } from "@/components/admin/action-button";
import { reopenCashDay } from "@/app/actions/cash";
import { buildCashDay, recentCloses, unclosedDays } from "@/lib/cash";
import { formatJalaliWithWeekday, formatJalaliDateTime, ymdKey } from "@/lib/date";
import { cn, formatToman, toFa } from "@/lib/utils";
import { TableScroll } from "@/components/admin/table-scroll";

export const dynamic = "force-dynamic";

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return ymdKey(date);
}

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await guardPage("payroll");
  const session = await getSession();
  const { date: raw } = await searchParams;

  const today = ymdKey(new Date());
  const dateKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;

  const [day, history, pending] = await Promise.all([
    buildCashDay(dateKey),
    recentCloses(20),
    unclosedDays(14),
  ]);

  const isFuture = dateKey > today;

  return (
    <>
      <AdminPageHeader
        title="بستن صندوق"
        description="آخر شب پول کشو را بشمارید و همین‌جا ثبت کنید. اگر اختلافی باشد همان روز معلوم می‌شود، نه آخر ماه."
      />

      {/* روزهایی که پول گرفته شده ولی بسته نشده */}
      {pending.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200">
            <TriangleAlert className="size-4 shrink-0" />
            {toFa(pending.length)} روز بسته نشده
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pending.map((key) => (
              <Link
                key={key}
                href={`/admin/cash?date=${key}`}
                className="rounded-xl bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              >
                {formatJalaliWithWeekday(new Date(key))}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* پیمایش روز */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/admin/cash?date=${shift(dateKey, -1)}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] px-4 py-2.5 text-sm transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <ArrowRight className="size-4" />
          روز قبل
        </Link>

        <div className="text-center">
          <p className="font-bold">{formatJalaliWithWeekday(day.day)}</p>
          {dateKey !== today && (
            <Link href="/admin/cash" className="text-xs text-rose-500 hover:underline">
              برگرد به امروز
            </Link>
          )}
        </div>

        <Link
          href={`/admin/cash?date=${shift(dateKey, 1)}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] px-4 py-2.5 text-sm transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          روز بعد
          <ArrowLeft className="size-4" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* آنچه سیستم انتظار دارد */}
        <Card>
          <h2 className="font-bold">دریافتی امروز طبق سیستم</h2>

          <ul className="mt-4 space-y-2.5">
            {day.lines.map((line) => (
              <li
                key={line.method}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm",
                  line.method === "CASH"
                    ? "bg-[color:var(--bg-sunken)] font-medium"
                    : "text-[color:var(--fg-muted)]",
                )}
              >
                <span>
                  {line.label}
                  {line.count > 0 && (
                    <span className="mr-2 text-xs text-[color:var(--fg-muted)]">
                      ({toFa(line.count)} پرداخت)
                    </span>
                  )}
                </span>
                <span className="tabular-nums">{formatToman(line.amount, false)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-[color:var(--line)] pt-4 text-sm">
            <span className="text-[color:var(--fg-muted)]">جمع کل دریافتی</span>
            <span className="font-bold tabular-nums">{formatToman(day.total)}</span>
          </div>

          {day.cashExpenseRows.length > 0 && (
            <div className="mt-5 border-t border-[color:var(--line)] pt-4">
              <p className="text-xs font-medium text-[color:var(--fg-muted)]">
                هزینه‌هایی که از صندوق پرداخت شده
              </p>
              <ul className="mt-2 space-y-1.5">
                {day.cashExpenseRows.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 text-xs">
                    <span className="truncate">{e.title}</span>
                    <span className="shrink-0 tabular-nums text-red-600 dark:text-red-300">
                      − {formatToman(e.amount, false)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 rounded-2xl bg-gradient-to-bl from-rose-50 to-cream-50 p-4 dark:from-rose-500/10 dark:to-plum-800/40">
            <p className="text-xs text-[color:var(--fg-muted)]">
              پس باید این‌قدر پول نقد در کشو باشد
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {formatToman(day.expectedInDrawer)}
            </p>
            {day.cashExpenses > 0 && (
              <p className="mt-1.5 text-[11px] text-[color:var(--fg-muted)]">
                {formatToman(day.expectedCash, false)} نقدی منهای{" "}
                {formatToman(day.cashExpenses, false)} هزینه‌ی صندوق
              </p>
            )}
          </div>
        </Card>

        {/* شمارش */}
        <Card>
          {day.closed && (
            <div className={cn(!isFuture && "border-b border-[color:var(--line)] pb-5")}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-bold">این روز بسته شده</h2>
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-2xl",
                    day.closed.difference === 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
                  )}
                >
                  {day.closed.difference === 0 ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <TriangleAlert className="size-5" />
                  )}
                </span>
              </div>

              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[color:var(--fg-muted)]">انتظار</dt>
                  <dd className="tabular-nums">{formatToman(day.closed.expectedInDrawer)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[color:var(--fg-muted)]">شمرده‌شده</dt>
                  <dd className="font-medium tabular-nums">{formatToman(day.closed.countedCash)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-[color:var(--line)] pt-2.5">
                  <dt className="font-medium">اختلاف</dt>
                  <dd
                    className={cn(
                      "font-bold tabular-nums",
                      day.closed.difference === 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : day.closed.difference > 0
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-red-600 dark:text-red-300",
                    )}
                  >
                    {day.closed.difference === 0
                      ? "بدون اختلاف"
                      : day.closed.difference > 0
                        ? `${formatToman(day.closed.difference, false)} اضافه`
                        : `${formatToman(Math.abs(day.closed.difference), false)} کسری`}
                  </dd>
                </div>
              </dl>

              {day.closed.note && (
                <p className="mt-4 rounded-xl bg-[color:var(--bg-sunken)] p-3.5 text-sm leading-7">
                  {day.closed.note}
                </p>
              )}

              <p className="mt-4 text-xs text-[color:var(--fg-muted)]">
                {day.closed.closedBy ? `${day.closed.closedBy} — ` : ""}
                {formatJalaliDateTime(day.closed.closedAt)}
              </p>

              {session?.role === "ADMIN" && (
                <div className="mt-4">
                  <ActionButton
                    action={async () => {
                      "use server";
                      const rows = await recentCloses(60);
                      const row = rows.find((r) => r.dateKey === dateKey);
                      if (!row) return { ok: false, message: "پیدا نشد." };
                      return reopenCashDay(row.id);
                    }}
                    confirm="شمارش این روز کلاً پاک شود و روز دوباره «بسته‌نشده» حساب شود؟"
                    className="text-xs"
                  >
                    پاک‌کردن شمارش این روز
                  </ActionButton>
                </div>
              )}
            </div>
          )}

          {isFuture ? (
            !day.closed && (
              <EmptyState
                icon={Wallet}
                title="این روز هنوز نیامده"
                description="فقط روزهای گذشته و امروز را می‌شود بست."
              />
            )
          ) : (
            /* فرم همیشه در همین جای درخت می‌ماند تا بعد از ثبت،
               پیام نتیجه‌اش با رندر دوباره‌ی صفحه از بین نرود */
            <div className={cn(day.closed && "pt-5")}>
              <h2 className="mb-4 flex items-center gap-2 font-bold">
                <Lock className="size-4" />
                {day.closed ? "اصلاح شمارش" : "شمارش کشو"}
              </h2>
              <CashCloseForm
                dateKey={dateKey}
                expectedInDrawer={day.expectedInDrawer}
                alreadyClosed={!!day.closed}
              />
            </div>
          )}
        </Card>
      </div>

      {/* تاریخچه */}
      <Card padded={false} className="mt-6">
        <div className="border-b border-[color:var(--line)] p-4 sm:p-6">
          <h2 className="font-bold">روزهای بسته‌شده‌ی اخیر</h2>
        </div>

        {history.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              icon={Wallet}
              title="هنوز صندوقی بسته نشده"
              description="از امشب شروع کنید — بعد از چند روز، الگوی کسری و اضافه خودش را نشان می‌دهد."
            />
          </div>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[31rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">روز</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">انتظار</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">شمرده</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">اختلاف</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">بست</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 sm:px-5 py-3.5">
                      <Link
                        href={`/admin/cash?date=${row.dateKey}`}
                        className="font-medium hover:text-rose-500"
                      >
                        {formatJalaliWithWeekday(row.day)}
                      </Link>
                      {row.note && (
                        <p className="mt-1 truncate text-xs text-[color:var(--fg-muted)]">
                          {row.note}
                        </p>
                      )}
                    </td>
                    <td className="px-3 sm:px-5 py-3.5 tabular-nums text-[color:var(--fg-muted)]">
                      {formatToman(row.expectedInDrawer, false)}
                    </td>
                    <td className="px-3 sm:px-5 py-3.5 tabular-nums">{formatToman(row.countedCash, false)}</td>
                    <td
                      className={cn(
                        "px-5 py-3.5 font-medium tabular-nums",
                        row.difference === 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : row.difference > 0
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-red-600 dark:text-red-300",
                      )}
                    >
                      {row.difference === 0 ? "—" : formatToman(row.difference, false)}
                    </td>
                    <td className="px-3 sm:px-5 py-3.5 text-xs text-[color:var(--fg-muted)]">
                      {row.closedBy ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </>
  );
}
