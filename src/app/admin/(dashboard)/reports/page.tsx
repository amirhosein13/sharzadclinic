import Link from "next/link";
import {
  BarChart3, CalendarX2, Download, Megaphone, MessageSquareHeart, Receipt, Smile, Star,
  TrendingDown, TrendingUp, TriangleAlert, UserPlus, Users, Wallet,
} from "lucide-react";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ReportTrendChart } from "@/components/admin/revenue-chart";
import { buildReport, isRangeKey, RANGE_PRESETS, resolveRange } from "@/lib/reports";
import { buildSatisfaction } from "@/lib/feedback";
import { buildProfit } from "@/lib/expenses";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** میله‌ی سهم — بدون کتابخانه، فقط برای خواناتر شدن جدول‌ها */
function Share({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
      <div
        className="h-full rounded-full bg-gradient-to-l from-rose-400 to-rose-600"
        style={{ width: `${Math.max(percent, value > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

/** «۱۲٪ بیشتر از دوره‌ی قبل» — عدد خالی معنی ندارد، مقایسه دارد */
function Delta({
  change,
  label,
  before,
  now,
}: {
  change: number | null;
  label: string;
  before: number;
  now: number;
}) {
  // درصدِ رشد از صفر معنی ندارد، ولی «دوره‌ی قبل صفر بود» خودش خبر است
  if (change === null) {
    if (before !== 0 || now <= 0) return null;
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
        title={`نسبت به ${label}`}
      >
        <TrendingUp className="size-3" />
        دوره‌ی قبل چیزی ثبت نشده بود
      </span>
    );
  }
  const up = change > 0;
  const flat = change === 0;

  return (
    <span
      className={
        flat
          ? "inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--fg-muted)]"
          : up
            ? "inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
            : "inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-300"
      }
      title={`نسبت به ${label}`}
    >
      {flat ? null : up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {flat ? "بدون تغییر" : `${toFa(Math.abs(change))}٪ ${up ? "بیشتر" : "کمتر"} از دوره‌ی قبل`}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  delta?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[color:var(--fg-muted)]">{label}</p>
          <p className="mt-2 text-xl font-extrabold">{value}</p>
          {delta && <p className="mt-1.5">{delta}</p>}
          {hint && <p className="mt-1.5 text-[11px] text-[color:var(--fg-muted)]">{hint}</p>}
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white">
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await guardPage("payroll");

  const { range: rangeParam } = await searchParams;
  const rangeKey = isRangeKey(rangeParam) ? rangeParam : "this-month";
  const range = resolveRange(rangeKey);
  const [report, satisfaction, profit] = await Promise.all([
    buildReport(range),
    buildSatisfaction(range.from, range.to),
    buildProfit(range.from, range.to),
  ]);

  const maxService = Math.max(1, ...report.byService.map((r) => r.revenue));
  const maxStaff = Math.max(1, ...report.byStaff.map((r) => r.revenue));
  const maxWeekday = Math.max(1, ...report.byWeekday.map((r) => r.sessions));
  const maxHour = Math.max(1, ...report.byHour.map((r) => r.sessions));
  const hasData = report.paymentCount > 0 || report.appointments.total > 0;

  return (
    <>
      <AdminPageHeader
        title="گزارش‌ها"
        description={`${report.range.label} — درآمد، عملکرد پرسنل، رفتار مشتری‌ها و شلوغی کلینیک.`}
        action={
          <Link
            href={`/api/reports/export?range=${rangeKey}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(183,110,121,0.7)] transition-colors hover:bg-rose-600"
          >
            <Download className="size-4" />
            خروجی اکسل
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGE_PRESETS.map((preset) => (
          <Link
            key={preset.key}
            href={`/admin/reports?range=${preset.key}`}
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

      {!hasData ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="در این بازه داده‌ای ثبت نشده"
            description="بازه‌ی دیگری را انتخاب کنید یا اول نوبت‌ها و پرداخت‌ها را ثبت کنید."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={Wallet}
              label="درآمد ثبت‌شده"
              value={formatToman(report.revenue)}
              delta={
                report.previous && (
                  <Delta
                    change={report.previous.revenueChange}
                    label={report.previous.label}
                    before={report.previous.revenue}
                    now={report.revenue}
                  />
                )
              }
              hint={`${toFa(report.paymentCount)} پرداخت • میانگین ${formatToman(report.averageTicket)}`}
            />
            <Stat
              icon={TrendingUp}
              label="جلسات انجام‌شده"
              value={toFa(report.appointments.done)}
              delta={
                report.previous && (
                  <Delta
                    change={report.previous.sessionsChange}
                    label={report.previous.label}
                    before={report.previous.sessions}
                    now={report.appointments.done}
                  />
                )
              }
              hint={`از ${toFa(report.appointments.total)} نوبت این بازه`}
            />
            <Stat
              icon={CalendarX2}
              label="عدم مراجعه"
              value={`${toFa(report.appointments.noShowRate)}٪`}
              hint={`${toFa(report.appointments.noShow)} نیامده • ${toFa(report.appointments.cancelled)} لغو‌شده`}
            />
            <Stat
              icon={UserPlus}
              label="مشتری جدید"
              value={toFa(report.customers.newCount)}
              delta={
                report.previous && (
                  <Delta
                    change={report.previous.newCustomersChange}
                    label={report.previous.label}
                    before={report.previous.newCustomers}
                    now={report.customers.newCount}
                  />
                )
              }
              hint={`${toFa(report.customers.returningRate)}٪ از مراجعین این بازه، قبلاً هم آمده‌اند`}
            />
          </div>

          {report.daily.length > 1 && (
            <Card className="mt-6">
              <h2 className="mb-5 font-bold">روند درآمد</h2>
              <ReportTrendChart data={report.daily} />
            </Card>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card padded={false}>
              <h2 className="border-b border-[color:var(--line)] p-6 font-bold">
                درآمد به تفکیک خدمت
              </h2>
              <ul className="divide-y divide-[color:var(--line)]">
                {report.byService.map((row) => (
                  <li key={row.key} className="p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{row.label}</span>
                      <span className="shrink-0 text-sm font-bold">{formatToman(row.revenue)}</span>
                    </div>
                    <p className="mt-1 mb-2.5 text-xs text-[color:var(--fg-muted)]">
                      {toFa(row.sessions)} جلسه
                    </p>
                    <Share value={row.revenue} max={maxService} />
                  </li>
                ))}
              </ul>
            </Card>

            <Card padded={false}>
              <h2 className="border-b border-[color:var(--line)] p-6 font-bold">
                عملکرد پرسنل
              </h2>
              <ul className="divide-y divide-[color:var(--line)]">
                {report.byStaff.map((row) => (
                  <li key={row.key} className="p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{row.label}</span>
                      <span className="shrink-0 text-sm font-bold">{formatToman(row.revenue)}</span>
                    </div>
                    <p className="mt-1 mb-2.5 text-xs text-[color:var(--fg-muted)]">
                      {toFa(row.sessions)} جلسه
                    </p>
                    <Share value={row.revenue} max={maxStaff} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-5 font-bold">شلوغی روزهای هفته</h2>
              <ul className="space-y-3">
                {report.byWeekday.map((row) => (
                  <li key={row.label} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-[color:var(--fg-muted)]">
                      {row.label}
                    </span>
                    <Share value={row.sessions} max={maxWeekday} />
                    <span className="w-8 shrink-0 text-left text-xs font-medium">
                      {toFa(row.sessions)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h2 className="mb-5 font-bold">شلوغی ساعت‌ها</h2>
              {report.byHour.length === 0 ? (
                <p className="text-sm text-[color:var(--fg-muted)]">داده‌ای نیست.</p>
              ) : (
                <ul className="space-y-3">
                  {report.byHour.map((row) => (
                    <li key={row.hour} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs text-[color:var(--fg-muted)]" dir="ltr">
                        {String(row.hour).padStart(2, "0")}:00
                      </span>
                      <Share value={row.sessions} max={maxHour} />
                      <span className="w-8 shrink-0 text-left text-xs font-medium">
                        {toFa(row.sessions)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card padded={false}>
              <h2 className="border-b border-[color:var(--line)] p-6 font-bold">
                مشتریان برتر این بازه
              </h2>
              {report.topCustomers.length === 0 ? (
                <p className="p-6 text-sm text-[color:var(--fg-muted)]">
                  هنوز جلسه‌ی انجام‌شده‌ای ثبت نشده است.
                </p>
              ) : (
                <ul className="divide-y divide-[color:var(--line)]">
                  {report.topCustomers.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 p-5">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="min-w-0 transition-colors hover:text-rose-500"
                      >
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="mt-0.5 block text-xs text-[color:var(--fg-muted)]" dir="ltr">
                          {toFa(c.phone)}
                        </span>
                      </Link>
                      <div className="shrink-0 text-left">
                        <p className="text-sm font-bold">{formatToman(c.spent)}</p>
                        <p className="mt-0.5 text-xs text-[color:var(--fg-muted)]">
                          {toFa(c.visits)} مراجعه
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="space-y-6">
              <Card>
                <h2 className="mb-5 flex items-center gap-2 font-bold">
                  <Users className="size-4 text-rose-500" />
                  مشتری‌ها
                </h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[color:var(--fg-muted)]">مراجعین این بازه</dt>
                    <dd className="font-medium">{toFa(report.customers.activeCount)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[color:var(--fg-muted)]">از قبل مشتری بوده‌اند</dt>
                    <dd className="font-medium">{toFa(report.customers.returningCount)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[color:var(--fg-muted)]">ثبت‌نام جدید</dt>
                    <dd className="font-medium">{toFa(report.customers.newCount)}</dd>
                  </div>
                </dl>
              </Card>

              <Card>
                <h2 className="mb-5 font-bold">روش پرداخت</h2>
                {report.byMethod.length === 0 ? (
                  <p className="text-sm text-[color:var(--fg-muted)]">پرداختی ثبت نشده است.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {report.byMethod.map((m) => (
                      <li key={m.key} className="flex items-center justify-between gap-3">
                        <span className="text-[color:var(--fg-muted)]">
                          {m.label}
                          <span className="mr-1.5 text-xs">({toFa(m.count)})</span>
                        </span>
                        <span className="font-medium">{formatToman(m.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {/* ── سود و هزینه ─────────────────────────────── */}
          <div className="mt-10 mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-extrabold">سود و هزینه</h2>
            <Link
              href="/admin/expenses"
              className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-300"
            >
              ثبت و مدیریت هزینه‌ها ←
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              icon={Wallet}
              label="درآمد"
              value={formatToman(profit.revenue)}
              hint="از پرداخت‌های ثبت‌شده"
            />
            <Stat
              icon={Receipt}
              label="هزینه"
              value={formatToman(profit.expenses)}
              hint={
                profit.expenses === 0
                  ? "هنوز هزینه‌ای ثبت نکرده‌اید"
                  : `${toFa(profit.expensesByCategory.length)} دسته`
              }
            />
            <Stat
              icon={profit.profit >= 0 ? TrendingUp : TrendingDown}
              label={profit.profit >= 0 ? "سود" : "زیان"}
              value={formatToman(Math.abs(profit.profit))}
              hint={`حاشیه‌ی سود ${toFa(profit.margin)}٪`}
            />
          </div>

          {profit.expenses === 0 && (
            <p className="mt-4 rounded-2xl border border-dashed border-[color:var(--line)] p-4 text-xs leading-7 text-[color:var(--fg-muted)]">
              تا وقتی هزینه‌ها (اجاره، حقوق، مواد، قبض‌ها) را ثبت نکنید، «سود» همان
              درآمد است و عدد واقعی نیست.
            </p>
          )}

          {profit.byService.length > 0 && (
            <Card className="mt-6" padded={false}>
              <div className="border-b border-[color:var(--line)] p-6">
                <h3 className="font-bold">سود هر خدمت</h3>
                <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
                  درآمد منهای بهای مواد و پورسانت پرسنل — پرسودترین‌ها اول.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[color:var(--line)] text-right text-xs text-[color:var(--fg-muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">خدمت</th>
                      <th className="px-5 py-3 font-medium">جلسه</th>
                      <th className="px-5 py-3 font-medium">درآمد</th>
                      <th className="px-5 py-3 font-medium">مواد</th>
                      <th className="px-5 py-3 font-medium">پورسانت</th>
                      <th className="px-5 py-3 font-medium">سود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--line)]">
                    {profit.byService.map((row) => (
                      <tr key={row.serviceId}>
                        <td className="px-5 py-4">
                          <span className="font-medium">{row.title}</span>
                          {row.missingMaterials && (
                            <span
                              title="برای این خدمت ماده‌ای تعریف نشده، پس بهای مواد صفر فرض شده"
                              className="mr-2 text-xs text-amber-600 dark:text-amber-300"
                            >
                              (بدون مواد)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 tabular-nums">{toFa(row.sessions)}</td>
                        <td className="px-5 py-4 tabular-nums">{formatToman(row.revenue, false)}</td>
                        <td className="px-5 py-4 tabular-nums text-[color:var(--fg-muted)]">
                          {formatToman(row.materialCost, false)}
                        </td>
                        <td className="px-5 py-4 tabular-nums text-[color:var(--fg-muted)]">
                          {formatToman(row.commission, false)}
                        </td>
                        <td
                          className={
                            row.profit >= 0
                              ? "px-5 py-4 font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
                              : "px-5 py-4 font-bold tabular-nums text-red-600 dark:text-red-300"
                          }
                        >
                          {formatToman(row.profit, false)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ── رضایت مشتری ─────────────────────────────── */}
          <div className="mt-10 mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-extrabold">رضایت مشتری‌ها</h2>
            <Link
              href="/admin/feedback"
              className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-300"
            >
              رسیدگی به نظرها ←
            </Link>
          </div>

          {satisfaction.responses === 0 ? (
            <Card>
              <EmptyState
                icon={MessageSquareHeart}
                title="در این بازه نظری ثبت نشده"
                description={
                  satisfaction.invitesSent > 0
                    ? `${toFa(satisfaction.invitesSent)} دعوت‌نامه فرستاده شده ولی هنوز کسی پاسخ نداده است.`
                    : "پس از «انجام‌شده» شدن هر نوبت، پیامک نظرسنجی خودکار برای مشتری می‌رود."
                }
              />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  icon={Star}
                  label="میانگین رضایت"
                  value={`${toFa(satisfaction.averageRating)} از ۵`}
                  hint={`${toFa(satisfaction.responses)} نظر • نرخ پاسخ ${toFa(satisfaction.responseRate)}٪`}
                />
                <Stat
                  icon={Smile}
                  label="راضی (۴ و ۵ ستاره)"
                  value={`${toFa(satisfaction.happyRate)}٪`}
                  hint={`${toFa(satisfaction.unhappyRate)}٪ ناراضی یا متوسط`}
                />
                <Stat
                  icon={Megaphone}
                  label="پیشنهاد به دیگران"
                  value={`${toFa(satisfaction.recommendRate)}٪`}
                  hint="از کسانی که به این سؤال جواب داده‌اند"
                />
                <Stat
                  icon={TriangleAlert}
                  label="نارضایتی باز"
                  value={toFa(satisfaction.openComplaints)}
                  hint="هنوز رسیدگی نشده"
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Card padded={false}>
                  <h3 className="border-b border-[color:var(--line)] p-6 font-bold">
                    بیشترین شکایت‌ها
                  </h3>
                  {satisfaction.complaints.length === 0 ? (
                    <p className="p-6 text-sm text-[color:var(--fg-muted)]">
                      هیچ‌کس از چیزی شکایت نکرده است.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--line)]">
                      {satisfaction.complaints.slice(0, 8).map((row) => (
                        <li key={row.key} className="p-5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium">{row.label}</span>
                            <span className="shrink-0 text-sm font-bold text-red-600 dark:text-red-300">
                              {toFa(row.count)} نفر
                            </span>
                          </div>
                          <div className="mt-2.5">
                            <Share value={row.count} max={satisfaction.complaints[0].count} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card padded={false}>
                  <h3 className="border-b border-[color:var(--line)] p-6 font-bold">
                    بیشترین تعریف‌ها
                  </h3>
                  {satisfaction.praises.length === 0 ? (
                    <p className="p-6 text-sm text-[color:var(--fg-muted)]">هنوز چیزی ثبت نشده.</p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--line)]">
                      {satisfaction.praises.slice(0, 8).map((row) => (
                        <li key={row.key} className="p-5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium">{row.label}</span>
                            <span className="shrink-0 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                              {toFa(row.count)} نفر
                            </span>
                          </div>
                          <div className="mt-2.5">
                            <Share value={row.count} max={satisfaction.praises[0].count} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Card padded={false}>
                  <h3 className="border-b border-[color:var(--line)] p-6 font-bold">
                    رضایت به تفکیک خدمت
                    <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                      (ضعیف‌ترین‌ها اول)
                    </span>
                  </h3>
                  <ul className="divide-y divide-[color:var(--line)]">
                    {satisfaction.byService.map((row) => (
                      <li key={row.key} className="flex items-center justify-between gap-3 p-5">
                        <span className="min-w-0 truncate text-sm font-medium">{row.label}</span>
                        <span className="shrink-0 text-sm">
                          <span className="font-bold">{toFa(row.average)}</span>
                          <span className="mr-1.5 text-xs text-[color:var(--fg-muted)]">
                            از {toFa(row.responses)} نظر
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card padded={false}>
                  <h3 className="border-b border-[color:var(--line)] p-6 font-bold">
                    رضایت به تفکیک پرسنل
                    <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                      (ضعیف‌ترین‌ها اول)
                    </span>
                  </h3>
                  <ul className="divide-y divide-[color:var(--line)]">
                    {satisfaction.byStaff.map((row) => (
                      <li key={row.key} className="flex items-center justify-between gap-3 p-5">
                        <span className="min-w-0 truncate text-sm font-medium">{row.label}</span>
                        <span className="shrink-0 text-sm">
                          <span className="font-bold">{toFa(row.average)}</span>
                          <span className="mr-1.5 text-xs text-[color:var(--fg-muted)]">
                            از {toFa(row.responses)} نظر
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              {satisfaction.recent.some((r) => r.comment) && (
                <Card className="mt-6">
                  <h3 className="mb-5 font-bold">آخرین حرف‌های مشتری‌ها</h3>
                  <ul className="space-y-4">
                    {satisfaction.recent
                      .filter((r) => r.comment)
                      .map((r) => (
                        <li
                          key={r.id}
                          className="rounded-2xl border border-[color:var(--line)] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">{r.customerName}</span>
                            <span className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={
                                    i < (r.rating ?? 0)
                                      ? "size-3.5 fill-gold-400 text-gold-400"
                                      : "size-3.5 text-[color:var(--line)]"
                                  }
                                />
                              ))}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">
                            «{r.comment}»
                          </p>
                        </li>
                      ))}
                  </ul>
                </Card>
              )}
            </>
          )}

          <p className="mt-6 text-xs leading-6 text-[color:var(--fg-muted)]">
            درآمد فقط از پرداخت‌های ثبت‌شده‌ی موفق شمرده می‌شود. اگر منشی مبلغ جلسه‌ای
            را ثبت نکند، آن جلسه در تعداد می‌آید ولی در درآمد نه.
          </p>
        </>
      )}
    </>
  );
}
