import { Mail, MessageSquare, Send, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { timeAgoFa } from "@/lib/date";
import { toFa } from "@/lib/utils";
import { TableScroll } from "@/components/admin/table-scroll";

export const dynamic = "force-dynamic";

const TEMPLATE_LABELS: Record<string, string> = {
  otp: "کد ورود",
  booking_created: "ثبت نوبت",
  booking_confirmed: "تأیید نوبت",
  booking_cancelled: "لغو نوبت",
  booking_reminder: "یادآوری نوبت",
  booking_created_email: "ایمیل ثبت نوبت",
  contact_received: "پیام تماس",
};

const STATUS_META: Record<string, { label: string; tone: "green" | "red" | "amber" }> = {
  sent: { label: "ارسال شد", tone: "green" },
  failed: { label: "ناموفق", tone: "red" },
  skipped: { label: "شبیه‌سازی", tone: "amber" },
};

export default async function NotificationsPage() {
  await guardPage("notifications");
  const [logs, counts] = await Promise.all([
    prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notificationLog.groupBy({ by: ["status"], _count: true }),
  ]);

  const countFor = (status: string) => counts.find((c) => c.status === status)?._count ?? 0;
  const simulated = countFor("skipped");

  return (
    <>
      <AdminPageHeader
        title="پیامک و ایمیل"
        description="گزارش صد اطلاع‌رسانی اخیر. برای ارسال واقعی پیامک، مقادیر کاوه‌نگار را در فایل .env تنظیم کنید."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat icon={Send} label="ارسال موفق" value={countFor("sent")} tone="green" />
        <Stat icon={TriangleAlert} label="ناموفق" value={countFor("failed")} tone="red" />
        <Stat icon={MessageSquare} label="شبیه‌سازی‌شده" value={simulated} tone="amber" />
      </div>

      {process.env.NODE_ENV === "production" && (process.env.SMS_PROVIDER ?? "console") === "console" && (
        <Card className="mb-6 border-red-300/60 bg-red-50/60 dark:border-red-400/25 dark:bg-red-500/5">
          <p className="flex items-start gap-3 text-sm leading-7">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
            <span>
              <strong>سایت منتشر شده اما سرویس پیامک تنظیم نشده است.</strong> در این حالت مشتریان
              نمی‌توانند وارد حساب کاربری شوند و پیامک تأیید و یادآوری نوبت هم ارسال نمی‌شود.
              برای رفع این مشکل مقادیر کاوه‌نگار را در فایل <code className="rounded bg-[color:var(--bg-sunken)] px-1.5 py-0.5 text-xs">.env</code> سرور وارد کنید.
            </span>
          </p>
        </Card>
      )}

      {simulated > 0 && (
        <Card className="mb-6 border-amber-300/60 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-500/5">
          <p className="text-sm leading-7">
            ⚠️ سرویس پیامک روی حالت <strong>شبیه‌سازی</strong> است و پیام‌ها واقعاً ارسال نمی‌شوند.
            برای فعال‌کردن ارسال واقعی، در فایل <code className="rounded bg-[color:var(--bg-sunken)] px-1.5 py-0.5 text-xs">.env</code>{" "}
            مقدار <code className="rounded bg-[color:var(--bg-sunken)] px-1.5 py-0.5 text-xs">SMS_PROVIDER</code> را
            روی <code className="rounded bg-[color:var(--bg-sunken)] px-1.5 py-0.5 text-xs">kavenegar</code> بگذارید و
            کلید API را وارد کنید.
          </p>
        </Card>
      )}

      {logs.length === 0 ? (
        <EmptyState icon={MessageSquare} title="هنوز پیامی ارسال نشده" />
      ) : (
        <Card padded={false}>
          <TableScroll>
            <table className="w-full min-w-[39rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">کانال</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">نوع پیام</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">گیرنده</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">وضعیت</th>
                  <th className="px-3 sm:px-5 py-3 text-right font-medium">زمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-[color:var(--bg-sunken)]">
                    <td className="px-3 sm:px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        {log.channel === "SMS" ? (
                          <MessageSquare className="size-3.5 text-rose-500" />
                        ) : (
                          <Mail className="size-3.5 text-rose-500" />
                        )}
                        {log.channel === "SMS" ? "پیامک" : "ایمیل"}
                      </span>
                    </td>
                    <td className="px-3 sm:px-5 py-4">{TEMPLATE_LABELS[log.template] ?? log.template}</td>
                    <td className="px-3 sm:px-5 py-4 text-xs" dir="ltr">
                      <span className="block text-right">{toFa(log.recipient)}</span>
                    </td>
                    <td className="px-3 sm:px-5 py-4">
                      <Badge tone={STATUS_META[log.status]?.tone ?? "neutral"}>
                        {STATUS_META[log.status]?.label ?? log.status}
                      </Badge>
                      {log.error && (
                        <p className="mt-1 max-w-52 truncate text-[11px] text-red-600 dark:text-red-300" title={log.error}>
                          {log.error}
                        </p>
                      )}
                    </td>
                    <td className="px-3 sm:px-5 py-4 text-xs text-[color:var(--fg-muted)]">
                      {timeAgoFa(log.createdAt)}
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

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "green" | "red" | "amber";
}) {
  const colors = {
    green: "text-emerald-600 dark:text-emerald-300",
    red: "text-red-600 dark:text-red-300",
    amber: "text-amber-600 dark:text-amber-300",
  };
  return (
    <Card className="flex items-center gap-4">
      <Icon className={`size-6 shrink-0 ${colors[tone]}`} />
      <div>
        <p className="text-xl font-extrabold">{toFa(value)}</p>
        <p className="text-xs text-[color:var(--fg-muted)]">{label}</p>
      </div>
    </Card>
  );
}
