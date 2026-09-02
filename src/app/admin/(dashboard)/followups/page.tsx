import Link from "next/link";
import { CalendarClock, CheckCircle2, PhoneCall, RefreshCw, Sparkles, X } from "lucide-react";
import { guardPage } from "@/lib/guard";
import { listOpenFollowUps, listUnconfirmed } from "@/lib/followups";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { FollowUpCard } from "@/components/admin/followup-card";
import { refreshFollowUps } from "@/app/actions/followup";
import { StatusSelect } from "@/components/admin/status-select";
import { formatJalaliLong, formatJalaliWithWeekday, formatTime } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  await guardPage("appointments.all");

  const [items, unconfirmed, doneToday] = await Promise.all([
    listOpenFollowUps(),
    listUnconfirmed(),
    prisma.followUp.count({
      where: {
        status: { in: ["DONE", "DISMISSED"] },
        handledAt: { gte: startOfToday() },
      },
    }),
  ]);

  const overdue = items.filter((i) => i.overdueDays > 0);
  const upcoming = items.filter((i) => i.overdueDays <= 0);
  const noShow = items.filter((i) => i.kind === "NO_SHOW");
  const nextSession = items.filter((i) => i.kind === "NEXT_SESSION");

  return (
    <>
      <AdminPageHeader
        title="پیگیری مراجعین"
        description="کارتابل روزانه‌ی تماس‌ها. هر مورد را که تمام کردید، از فهرست خارج می‌شود."
        action={
          <ActionButton action={refreshFollowUps} className="h-11 px-5 text-sm">
            <RefreshCw className="size-4" />
            به‌روزرسانی فهرست
          </ActionButton>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat icon={PhoneCall} label="در انتظار تماس" value={toFa(items.length)} tone="rose" />
        <Stat icon={X} label="مراجعه نکردند" value={toFa(noShow.length)} tone="red" />
        <Stat icon={Sparkles} label="وقت جلسه‌ی بعد" value={toFa(nextSession.length)} tone="gold" />
        <Stat icon={CheckCircle2} label="امروز انجام شد" value={toFa(doneToday)} tone="green" />
      </div>

      {/* نوبت‌های تأییدنشده‌ی نزدیک */}
      {unconfirmed.length > 0 && (
        <Card className="mb-8" padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <CalendarClock className="size-[18px] text-amber-600" />
              نوبت‌های نزدیک که هنوز تأیید نشده‌اند
              <span className="text-xs font-normal text-[color:var(--fg-muted)]">
                ({toFa(unconfirmed.length)} مورد)
              </span>
            </h2>
            <p className="text-xs text-[color:var(--fg-muted)]">
              تماس بگیرید و وضعیت را روی «تأیید شده» بگذارید
            </p>
          </div>

          <ul className="divide-y divide-[color:var(--line)]">
            {unconfirmed.map((appt) => (
              <li key={appt.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <Link
                    href={`/admin/customers/${appt.customer.id}`}
                    className="font-medium hover:text-rose-500"
                  >
                    {appt.customer.firstName} {appt.customer.lastName}
                  </Link>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                    {appt.service.title} • {formatJalaliWithWeekday(appt.startsAt)} ساعت{" "}
                    {formatTime(appt.startsAt)}
                    {appt.staff && ` • ${appt.staff.name}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${appt.customer.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3.5 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
                  >
                    <PhoneCall className="size-3.5" />
                    <span dir="ltr">{toFa(appt.customer.phone)}</span>
                  </a>
                  <StatusSelect id={appt.id} value={appt.status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* پیگیری‌های عقب‌افتاده */}
      {overdue.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <span className="grid size-6 place-items-center rounded-full bg-red-500 text-xs font-bold text-white">
              {toFa(overdue.length)}
            </span>
            نیازمند تماس
          </h2>
          <div className="space-y-3">
            {overdue.map((item) => (
              <FollowUpCard key={item.id} item={toView(item)} />
            ))}
          </div>
        </section>
      )}

      {/* پیگیری‌های آینده */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold">
            پیگیری‌های بعدی
            <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
              ({toFa(upcoming.length)} مورد)
            </span>
          </h2>
          <div className="space-y-3">
            {upcoming.map((item) => (
              <FollowUpCard key={item.id} item={toView(item)} />
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && unconfirmed.length === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="فهرست پیگیری خالی است 🎉"
          description="همه‌ی تماس‌ها انجام شده. با دکمه‌ی «به‌روزرسانی فهرست» موارد جدید را بررسی کنید."
        />
      )}
    </>
  );
}

function toView(item: Awaited<ReturnType<typeof listOpenFollowUps>>[number]) {
  return {
    id: item.id,
    kind: item.kind,
    dueAt: item.dueAt.toISOString(),
    reason: item.reason,
    note: item.note,
    overdueDays: item.overdueDays,
    customerId: item.customer.id,
    customerName: item.customer.name,
    customerPhone: item.customer.phone,
    appointmentLabel: item.appointment
      ? `${item.appointment.serviceTitle} — ${formatJalaliLong(item.appointment.startsAt)} (کد ${item.appointment.code})`
      : null,
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "rose" | "red" | "gold" | "green";
}) {
  const colors = {
    rose: "text-rose-500",
    red: "text-red-600 dark:text-red-300",
    gold: "text-gold-600 dark:text-gold-300",
    green: "text-emerald-600 dark:text-emerald-300",
  };
  return (
    <Card className="flex items-center gap-4">
      <Icon className={`size-6 shrink-0 ${colors[tone]}`} />
      <div>
        <p className="text-xl font-extrabold">{value}</p>
        <p className="text-xs text-[color:var(--fg-muted)]">{label}</p>
      </div>
    </Card>
  );
}
