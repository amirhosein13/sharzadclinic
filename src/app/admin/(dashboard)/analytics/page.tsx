import Link from "next/link";
import {
  BarChart3, CalendarX2, Eye, Lightbulb, MousePointerClick, TrendingDown, UserX,
} from "lucide-react";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { isRangeKey, RANGE_PRESETS, resolveRange } from "@/lib/reports";
import { buildUtilization, hourLabel } from "@/lib/utilization";
import { buildSiteStats } from "@/lib/site-stats";
import { noShowCost, noShowReport } from "@/lib/no-shows";
import { formatJalaliLong } from "@/lib/date";
import { cn, formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** دقیقه به «۱۲ ساعت و ۳۰ دقیقه» */
function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${toFa(m)} دقیقه`;
  if (m === 0) return `${toFa(h)} ساعت`;
  return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
}

function Bar({ percent, tone }: { percent: number; tone: "low" | "mid" | "high" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "high"
            ? "bg-gradient-to-l from-emerald-400 to-emerald-600"
            : tone === "mid"
              ? "bg-gradient-to-l from-amber-400 to-amber-600"
              : "bg-gradient-to-l from-red-400 to-red-600",
        )}
        style={{ width: `${Math.max(percent, percent > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

const toneOf = (percent: number) => (percent >= 70 ? "high" : percent >= 40 ? "mid" : "low");

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await guardPage("payroll");

  const { range: rangeParam } = await searchParams;
  const rangeKey = isRangeKey(rangeParam) ? rangeParam : "last-3";
  const range = resolveRange(rangeKey);

  const [utilization, site, noShows, noShowMoney] = await Promise.all([
    buildUtilization(range),
    buildSiteStats(range),
    noShowReport(12),
    noShowCost(range.from, range.to),
  ]);

  return (
    <>
      <AdminPageHeader
        title="تحلیل و رشد"
        description="کجا ظرفیت هدر می‌رود، کدام صفحه‌ی سایت مشتری می‌آورد و کدام نه، و چقدر پول پشت نوبت‌های خالی مانده."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGE_PRESETS.map((preset) => (
          <Link
            key={preset.key}
            href={`/admin/analytics?range=${preset.key}`}
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

      {/* ── خلاصه ─────────────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">نرخ اشغال</p>
          <p className="mt-2 text-xl font-extrabold">{toFa(utilization.percent)}٪</p>
          <p className="mt-1.5 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            از {hours(utilization.capacity)} ظرفیت، {hours(utilization.booked)} پر شده
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">هزینه‌ی نوبت‌های خالی</p>
          <p className="mt-2 text-xl font-extrabold">{formatToman(noShowMoney.value)}</p>
          <p className="mt-1.5 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            {toFa(noShowMoney.count)} نفر نوبت گرفتند و نیامدند
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">بازدید صفحات خدمات</p>
          <p className="mt-2 text-xl font-extrabold">{toFa(site.totalViews)}</p>
          <p className="mt-1.5 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            {site.funnel.finished > 0
              ? `${toFa(site.funnel.finished)} رزرو از سایت`
              : "هنوز رزروی از سایت ثبت نشده"}
          </p>
        </Card>
      </div>

      {/* ── نرخ اشغال ─────────────────────────────────────── */}
      {!utilization.hasSchedules ? (
        <Card className="mb-6">
          <EmptyState
            icon={BarChart3}
            title="برای این گزارش، برنامه‌ی هفتگی پرسنل لازم است"
            description="تا وقتی برنامه‌ی هفتگی وارد نشده، معلوم نیست چقدر ظرفیت داشته‌ایم که بشود گفت چقدرش پر شده."
          />
        </Card>
      ) : (
        <>
          {utilization.worstSlots.length > 0 && utilization.worstSlots[0].percent < 60 && (
            <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                <Lightbulb className="size-4 shrink-0" />
                خالی‌ترین روزهای شما
              </p>
              <p className="mt-2 text-xs leading-6 text-amber-900 dark:text-amber-200">
                {utilization.worstSlots
                  .map((s) => `${s.label} (${toFa(s.percent)}٪ پر)`)
                  .join("، ")}
                . یا شیفت را کم کنید، یا برای همین روزها تخفیف بگذارید و در پیامک گروهی
                خبرش را بدهید.
              </p>
            </Card>
          )}

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Card padded={false}>
              <h2 className="border-b border-[color:var(--line)] p-6 font-bold">
                نرخ اشغال روزهای هفته
              </h2>
              <ul className="space-y-4 p-6">
                {utilization.byWeekday.map((row) => (
                  <li key={row.weekday}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-xs text-[color:var(--fg-muted)]">
                        {toFa(row.percent)}٪ — {hours(row.booked)} از {hours(row.capacity)}
                      </span>
                    </div>
                    <Bar percent={row.percent} tone={toneOf(row.percent)} />
                  </li>
                ))}
              </ul>
            </Card>

            <Card padded={false}>
              <h2 className="border-b border-[color:var(--line)] p-6 font-bold">
                نرخ اشغال ساعت‌ها
              </h2>
              <ul className="space-y-3 p-6">
                {utilization.byHour.map((row) => (
                  <li key={row.hour} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-[color:var(--fg-muted)]" dir="ltr">
                      {toFa(hourLabel(row.hour))}
                    </span>
                    <Bar percent={row.percent} tone={toneOf(row.percent)} />
                    <span className="w-10 shrink-0 text-left text-xs font-medium">
                      {toFa(row.percent)}٪
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {utilization.byStaff.length > 0 && (
            <Card padded={false} className="mb-6">
              <div className="border-b border-[color:var(--line)] p-6">
                <h2 className="font-bold">نرخ اشغال پرسنل</h2>
                <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
                  از کم‌کارترین به پرکارترین. عدد پایین یعنی شیفتش زیاد است یا خدماتش کم
                  درخواست دارد — نه لزوماً اینکه بد کار می‌کند.
                </p>
              </div>
              <ul className="space-y-4 p-6">
                {utilization.byStaff.map((row) => (
                  <li key={row.staffId}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-xs text-[color:var(--fg-muted)]">
                        {toFa(row.percent)}٪ — {hours(row.booked)} از {hours(row.capacity)}
                      </span>
                    </div>
                    <Bar percent={row.percent} tone={toneOf(row.percent)} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {/* ── سایت ──────────────────────────────────────────── */}
      <Card padded={false} className="mb-6">
        <div className="border-b border-[color:var(--line)] p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <Eye className="size-4" />
            کدام صفحه مشتری می‌آورد؟
          </h2>
          <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
            بازدید صفحه‌ی هر خدمت، و اینکه چند درصدشان به رزرو رسید. صفحه‌ای که بازدید زیاد و
            رزرو کم دارد، یا قیمتش می‌ترساند یا متنش قانع‌کننده نیست.
          </p>
        </div>

        {site.byService.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={MousePointerClick}
              title="هنوز آماری جمع نشده"
              description="از این به بعد بازدید صفحات خدمات شمرده می‌شود. چند روز که بگذرد، این‌جا پر می‌شود."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-right font-medium">خدمت</th>
                  <th className="px-5 py-3 text-right font-medium">بازدید</th>
                  <th className="px-5 py-3 text-right font-medium">رزرو</th>
                  <th className="px-5 py-3 text-right font-medium">نرخ تبدیل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {site.byService.map((row) => (
                  <tr key={row.slug}>
                    <td className="px-5 py-3.5 font-medium">{row.title}</td>
                    <td className="px-5 py-3.5 tabular-nums">{toFa(row.views)}</td>
                    <td className="px-5 py-3.5 tabular-nums">{toFa(row.bookings)}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          row.views >= 20 && row.conversion < 3
                            ? "text-red-600 dark:text-red-300"
                            : row.conversion >= 10
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "",
                        )}
                      >
                        {toFa(row.conversion)}٪
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── قیف رزرو ──────────────────────────────────────── */}
      {site.funnel.started > 0 && (
        <Card className="mb-6">
          <h2 className="flex items-center gap-2 font-bold">
            <TrendingDown className="size-4" />
            مردم کجای رزرو را رها می‌کنند؟
          </h2>

          <ul className="mt-5 space-y-3">
            {[
              { label: "وارد صفحه‌ی رزرو شدند", value: site.funnel.started },
              { label: "خدمت را انتخاب کردند", value: site.funnel.pickedService },
              { label: "ساعت را انتخاب کردند", value: site.funnel.pickedTime },
              { label: "نوبت را ثبت کردند", value: site.funnel.finished },
            ].map((step) => {
              const percent =
                site.funnel.started > 0
                  ? Math.round((step.value / site.funnel.started) * 100)
                  : 0;
              return (
                <li key={step.label} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-sm">{step.label}</span>
                  <Bar percent={percent} tone={toneOf(percent)} />
                  <span className="w-16 shrink-0 text-left text-xs font-medium tabular-nums">
                    {toFa(step.value)} ({toFa(percent)}٪)
                  </span>
                </li>
              );
            })}
          </ul>

          {site.funnel.biggestDropLabel && (
            <p className="mt-5 rounded-xl bg-amber-50 p-3.5 text-xs leading-6 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              بیشترین ریزش: <b>{site.funnel.biggestDropLabel}</b> — {toFa(site.funnel.biggestDropPercent)}٪
              از افراد همین‌جا بیرون می‌روند.
              {site.funnel.biggestDropLabel.includes("ساعت") &&
                " معمولاً یعنی وقت خالیِ مناسبی پیدا نکرده‌اند؛ برنامه‌ی پرسنل را ببینید."}
            </p>
          )}
        </Card>
      )}

      {/* ── بدقول‌ها ───────────────────────────────────────── */}
      <Card padded={false}>
        <div className="border-b border-[color:var(--line)] p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <UserX className="size-4" />
            مشتری‌هایی که نمی‌آیند
          </h2>
          <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
            یک سال اخیر. هر نوبتِ خالی‌مانده یعنی پرسنل نشسته و جای یک نفر دیگر هم گرفته شده.
          </p>
        </div>

        {noShows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarX2}
              title="کسی سابقه‌ی نیامدنِ مکرر ندارد"
              description="عالی است — یعنی یادآوری‌ها کار می‌کنند."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {noShows.map((row) => (
              <li key={row.customerId} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <Link
                    href={`/admin/customers/${row.customerId}`}
                    className="text-sm font-medium hover:text-rose-500"
                  >
                    {row.name}
                  </Link>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]" dir="ltr">
                    {toFa(row.phone)}
                  </p>
                </div>

                <div className="shrink-0 text-left">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      row.risk === "high" ? "text-red-600 dark:text-red-300" : "",
                    )}
                  >
                    {toFa(row.total)} بار نیامده
                    {row.streak > 1 && ` (${toFa(row.streak)} بار پشت‌سرهم)`}
                  </p>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
                    حدود {formatToman(row.wastedValue)}
                    {row.lastAt && ` • آخرین بار ${formatJalaliLong(row.lastAt)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
