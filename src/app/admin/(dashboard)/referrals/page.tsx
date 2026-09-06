import Link from "next/link";
import { Gift, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { topReferrers } from "@/lib/referrals";
import { formatJalaliLong } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  await guardPage("customers");

  const settings = await getSettings();
  const enabled = settings.referralEnabled === "1";

  const [referrals, leaders, counts] = await Promise.all([
    prisma.referral.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        referrer: { select: { id: true, firstName: true, lastName: true } },
        referred: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    }),
    topReferrers(10),
    prisma.referral.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countOf = (status: string) =>
    counts.find((c) => c.status === status)?._count._all ?? 0;
  const rewardedCount = countOf("REWARDED");
  const pendingCount = countOf("PENDING");

  return (
    <>
      <AdminPageHeader
        title="کد معرف"
        description="چه کسی چه کسی را آورد. هدیه فقط وقتی صادر می‌شود که معرفی‌شده واقعاً یک جلسه انجام داده باشد."
      />

      {!enabled && (
        <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
            سیستم کد معرف خاموش است
          </p>
          <p className="mt-2 text-xs leading-6 text-amber-800 dark:text-amber-200">
            تا روشنش نکنید، کد معرف در فرم رزرو و پنل مشتری دیده نمی‌شود و هدیه‌ای صادر نمی‌شود.
            از{" "}
            <Link href="/admin/settings" className="underline underline-offset-4">
              تنظیمات
            </Link>{" "}
            روشنش کنید و مبلغ هدیه‌ها را بگذارید.
          </p>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">معرفی‌های موفق</p>
          <p className="mt-2 text-xl font-extrabold">{toFa(rewardedCount)}</p>
          <p className="mt-1.5 text-[11px] text-[color:var(--fg-muted)]">
            معرفی‌شده آمد و هدیه صادر شد
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">در انتظار اولین جلسه</p>
          <p className="mt-2 text-xl font-extrabold">{toFa(pendingCount)}</p>
          <p className="mt-1.5 text-[11px] text-[color:var(--fg-muted)]">
            کد وارد شده ولی هنوز جلسه‌ای انجام نشده
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">هدیه‌ی هر معرفی</p>
          <p className="mt-2 text-xl font-extrabold">
            {formatToman(Number(settings.referrerReward) || 0)}
          </p>
          <p className="mt-1.5 text-[11px] text-[color:var(--fg-muted)]">
            به‌علاوه {formatToman(Number(settings.referredReward) || 0)} برای معرفی‌شده
          </p>
        </Card>
      </div>

      {leaders.length > 0 && (
        <Card padded={false} className="mb-6">
          <h2 className="border-b border-[color:var(--line)] p-4 sm:p-6 font-bold">معرف‌های برتر</h2>
          <ul className="divide-y divide-[color:var(--line)]">
            {leaders.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <Link
                    href={`/admin/customers/${row.id}`}
                    className="text-sm font-medium hover:text-rose-500"
                  >
                    {row.name}
                  </Link>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]" dir="ltr">
                    {toFa(row.phone)}
                    {row.code ? ` • ${row.code}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.rewarded > 0 && (
                    <Badge tone="green">{toFa(row.rewarded)} معرفی موفق</Badge>
                  )}
                  {row.pending > 0 && <Badge>{toFa(row.pending)} در انتظار</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padded={false}>
        <h2 className="border-b border-[color:var(--line)] p-4 sm:p-6 font-bold">آخرین معرفی‌ها</h2>

        {referrals.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              icon={Users}
              title="هنوز معرفی‌ای ثبت نشده"
              description={
                enabled
                  ? "هر مشتری کد اختصاصی‌اش را در پنل خودش می‌بیند و می‌تواند برای دوستانش بفرستد."
                  : "اول سیستم کد معرف را از تنظیمات روشن کنید."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {referrals.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-sm">
                    <Link
                      href={`/admin/customers/${row.referrer.id}`}
                      className="font-medium hover:text-rose-500"
                    >
                      {row.referrer.firstName} {row.referrer.lastName}
                    </Link>
                    <span className="mx-2 text-[color:var(--fg-muted)]">←</span>
                    <Link
                      href={`/admin/customers/${row.referred.id}`}
                      className="font-medium hover:text-rose-500"
                    >
                      {row.referred.firstName} {row.referred.lastName}
                    </Link>
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                    {formatJalaliLong(row.createdAt)}
                    {row.referrerRewardCode && (
                      <span dir="ltr"> • {row.referrerRewardCode}</span>
                    )}
                  </p>
                </div>

                {row.status === "REWARDED" ? (
                  <Badge tone="green">
                    <Gift className="ml-1 size-3" />
                    هدیه صادر شد
                  </Badge>
                ) : row.status === "VOID" ? (
                  <Badge>باطل شده</Badge>
                ) : (
                  <Badge tone="amber">در انتظار اولین جلسه</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
