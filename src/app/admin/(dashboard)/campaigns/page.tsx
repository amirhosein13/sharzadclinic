import { Megaphone, Play, Send, Square } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { CampaignForm } from "@/components/admin/campaign-form";
import { ActionButton } from "@/components/admin/action-button";
import { cancelCampaign, continueCampaign, launchCampaign } from "@/app/actions/campaigns";
import { Badge } from "@/components/ui/badge";
import { DAILY_LIMIT, sentToday } from "@/lib/campaigns";
import { formatJalaliDateTime } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS = {
  DRAFT: { label: "پیش‌نویس", tone: "amber" as const },
  SENDING: { label: "در حال ارسال", tone: "rose" as const },
  DONE: { label: "تمام شد", tone: "green" as const },
  CANCELLED: { label: "متوقف شد", tone: undefined },
};

export default async function CampaignsPage() {
  await guardPage("notifications");

  const [campaigns, services, today, optedOut] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
      orderBy: { order: "asc" },
    }),
    sentToday(),
    prisma.customer.count({ where: { smsOptOut: true } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="پیامک گروهی"
        description="برای گروهی از مشتریان پیامک بفرستید — مثلاً کسانی که لیزر کرده‌اند و چند ماه است نیامده‌اند."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">امروز فرستاده شده</p>
          <p className="mt-2 text-xl font-extrabold">
            {toFa(today)}
            <span className="mr-1 text-sm font-normal text-[color:var(--fg-muted)]">
              از {toFa(DAILY_LIMIT)}
            </span>
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            سقف روزانه برای اینکه یک‌باره صدها پیامک نرود و خط پنل بسته نشود
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">انصراف‌داده از پیامک تبلیغاتی</p>
          <p className="mt-2 text-xl font-extrabold">{toFa(optedOut)}</p>
          <p className="mt-1.5 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            این‌ها هیچ‌وقت در فهرست ارسال نمی‌آیند. یادآوری نوبت و کد ورودشان قطع نمی‌شود.
          </p>
        </Card>
      </div>

      <div className="mb-6">
        <CampaignForm services={services} />
      </div>

      <Card padded={false}>
        <h2 className="border-b border-[color:var(--line)] p-4 sm:p-6 font-bold">ارسال‌های اخیر</h2>

        {campaigns.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              icon={Megaphone}
              title="هنوز ارسال گروهی نداشته‌اید"
              description="فرم بالا را پر کنید. اول پیش‌نویس ساخته می‌شود و تا خودتان «شروع ارسال» را نزنید، هیچ پیامکی نمی‌رود."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {campaigns.map((c) => (
              <li key={c.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{c.title}</h3>
                      <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                      {formatJalaliDateTime(c.createdAt)}
                      {c.createdBy ? ` — ${c.createdBy.name}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {c.status === "DRAFT" && (
                      <>
                        <ActionButton
                          action={launchCampaign.bind(null, c.id)}
                          confirm={`ارسال «${c.title}» شروع شود؟ این کار برگشت‌پذیر نیست.`}
                          className="text-xs"
                        >
                          <Play className="size-3.5" />
                          شروع ارسال
                        </ActionButton>
                        <ActionButton
                          action={cancelCampaign.bind(null, c.id)}
                          confirm="این پیش‌نویس دور ریخته شود؟"
                          className="text-xs"
                        >
                          <Square className="size-3.5" />
                          انصراف
                        </ActionButton>
                      </>
                    )}
                    {c.status === "SENDING" && (
                      <>
                        <ActionButton action={continueCampaign.bind(null, c.id)} className="text-xs">
                          <Send className="size-3.5" />
                          ادامه‌ی ارسال
                        </ActionButton>
                        <ActionButton
                          action={cancelCampaign.bind(null, c.id)}
                          confirm="ارسال متوقف شود؟ پیامک‌های نرفته دیگر فرستاده نمی‌شوند."
                          className="text-xs text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          <Square className="size-3.5" />
                          توقف
                        </ActionButton>
                      </>
                    )}
                  </div>
                </div>

                <p className="mt-3 rounded-xl bg-[color:var(--bg-sunken)] p-3.5 text-sm leading-7 whitespace-pre-wrap">
                  {c.message}
                </p>

                {c.total > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--fg-muted)]">
                      <span>
                        {toFa(c.sent)} رفت
                        {c.failed > 0 && ` • ${toFa(c.failed)} ناموفق`}
                      </span>
                      <span>از {toFa(c.total)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-rose-400 to-rose-600 transition-all"
                        style={{
                          width: `${Math.min(100, Math.round(((c.sent + c.failed) / c.total) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
