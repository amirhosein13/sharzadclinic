import Link from "next/link";
import { Hourglass, Phone } from "lucide-react";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { listWaitlist, WAITLIST_STATUS_META } from "@/lib/waitlist";
import { WaitlistActions } from "@/components/admin/waitlist-actions";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  await guardPage("appointments.all");
  const { all } = await searchParams;
  const showAll = all === "1";

  const entries = await listWaitlist(showAll);
  const waiting = entries.filter((e) => e.status === "WAITING").length;

  return (
    <>
      <AdminPageHeader
        title="لیست انتظار"
        description={
          waiting > 0
            ? `${toFa(waiting)} نفر منتظر وقت خالی‌اند. وقتی نوبتی لغو شد، از این‌جا خبرشان کنید.`
            : "کسی در انتظار وقت خالی نیست."
        }
        action={
          <Link
            href={showAll ? "/admin/waitlist" : "/admin/waitlist?all=1"}
            className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--line)] px-5 py-3 text-sm transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            {showAll ? "فقط درخواست‌های باز" : "نمایش همه (با بسته‌شده‌ها)"}
          </Link>
        }
      />

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Hourglass}
            title="لیست انتظار خالی است"
            description="اگر مشتری وقت دلخواهش را پیدا نکرد، از فرم رزرو یا از همین‌جا در لیست انتظار ثبتش کنید."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const meta = WAITLIST_STATUS_META[entry.status];
            return (
              <Card key={entry.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/customers/${entry.customerId}`}
                        className="font-bold transition-colors hover:text-rose-500"
                      >
                        {entry.customerName}
                      </Link>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {entry.isStale && entry.status === "WAITING" && (
                        <Badge tone="red">بازه‌اش گذشته</Badge>
                      )}
                    </div>

                    <p className="mt-2 text-sm">{entry.serviceTitle}</p>
                    <p className="mt-1 text-xs leading-6 text-[color:var(--fg-muted)]">
                      از {formatJalaliLong(entry.fromDate)} تا {formatJalaliLong(entry.toDate)}
                      {entry.notifiedAt && ` • خبر داده شد: ${formatJalaliLong(entry.notifiedAt)}`}
                    </p>
                    {entry.note && (
                      <p className="mt-2 rounded-xl bg-[color:var(--bg-sunken)] p-3 text-sm leading-7 text-[color:var(--fg-muted)]">
                        {entry.note}
                      </p>
                    )}

                    <a
                      href={`tel:${entry.phone}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline dark:text-rose-300"
                      dir="ltr"
                    >
                      <Phone className="size-3.5" />
                      {toFa(entry.phone)}
                    </a>
                  </div>

                  <WaitlistActions
                    id={entry.id}
                    status={entry.status}
                    customerName={entry.customerName}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
