import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card } from "@/components/admin/page-header";
import { buildHealth, type HealthLevel } from "@/lib/health";
import { formatJalaliDateTime } from "@/lib/date";
import { cn, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICONS: Record<HealthLevel, React.ComponentType<{ className?: string }>> = {
  ok: CheckCircle2,
  warn: TriangleAlert,
  bad: CircleAlert,
};

const TONES: Record<HealthLevel, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};

export default async function HealthPage() {
  await guardPage("settings");
  const report = await buildHealth();

  const allGood = report.bad === 0 && report.warn === 0;

  return (
    <>
      <AdminPageHeader
        title="سلامت سیستم"
        description="یک نگاه به اینکه همه‌چیز سر جایش هست یا نه — بدون نیاز به ترمینال."
      />

      <Card
        className={cn(
          "mb-6",
          report.bad > 0
            ? "border-red-300 bg-red-50 dark:border-red-400/30 dark:bg-red-500/10"
            : report.warn > 0
              ? "border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10",
        )}
      >
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl text-white",
              report.bad > 0
                ? "bg-red-500"
                : report.warn > 0
                  ? "bg-amber-500"
                  : "bg-emerald-500",
            )}
          >
            {report.bad > 0 ? (
              <CircleAlert className="size-5" />
            ) : report.warn > 0 ? (
              <TriangleAlert className="size-5" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </span>
          <div>
            <p className="font-bold">
              {allGood
                ? "همه‌چیز سالم است 🎉"
                : report.bad > 0
                  ? `${toFa(report.bad)} مشکل جدی`
                  : `${toFa(report.warn)} مورد قابل بهبود`}
            </p>
            <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
              {allGood
                ? "هیچ کاری لازم نیست."
                : report.bad > 0
                  ? "موارد قرمز یعنی بخشی از سایت واقعاً کار نمی‌کند. اول آن‌ها را درست کنید."
                  : "موارد زرد جلوی کار را نمی‌گیرند ولی بهتر است رسیدگی شوند."}
              <br />
              بررسی‌شده در {formatJalaliDateTime(report.checkedAt)}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        {report.groups.map((group) => (
          <Card key={group.title} padded={false}>
            <h2 className="border-b border-[color:var(--line)] p-4 sm:p-6 font-bold">{group.title}</h2>
            <ul className="divide-y divide-[color:var(--line)]">
              {group.checks.map((check) => {
                const Icon = ICONS[check.level];
                return (
                  <li key={check.key} className="flex items-start gap-3 p-5">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", TONES[check.level])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{check.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--fg-muted)]">{check.detail}</p>
                      {check.impact && (
                        <p
                          className={cn(
                            "mt-2 rounded-xl p-3 text-xs leading-6",
                            check.level === "bad"
                              ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200"
                              : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200",
                          )}
                        >
                          {check.impact}
                        </p>
                      )}
                    </div>
                    {check.href && check.level !== "ok" && (
                      <Link
                        href={check.href}
                        className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-300"
                      >
                        درستش کن
                        <ArrowLeft className="size-3" />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
