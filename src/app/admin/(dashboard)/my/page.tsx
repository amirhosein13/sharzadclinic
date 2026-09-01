import Link from "next/link";
import { CalendarDays, Clock, TriangleAlert, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { StatusSelect } from "@/components/admin/status-select";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/appointment-status";
import { formatJalaliWithWeekday, formatTime } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyAppointmentsPage() {
  const user = await guardPage("appointments.own");

  if (!user.staffId) {
    return (
      <>
        <AdminPageHeader title="نوبت‌های من" />
        <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-500/5">
          <p className="flex items-start gap-3 text-sm leading-8">
            <TriangleAlert className="mt-1 size-5 shrink-0 text-amber-600" />
            <span>
              حساب کاربری شما هنوز به هیچ پرسنلی متصل نشده است، بنابراین نوبتی برای نمایش وجود ندارد.
              از مدیر کلینیک بخواهید در بخش «کاربران» حساب شما را به پرسنل مربوطه وصل کند.
            </span>
          </p>
        </Card>
      </>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const monthStart = new Date(todayStart);
  monthStart.setDate(1);

  const [today, upcoming, doneThisMonth] = await Promise.all([
    prisma.appointment.findMany({
      where: { staffId: user.staffId, startsAt: { gte: todayStart, lt: todayEnd } },
      include: { customer: true, service: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        staffId: user.staffId,
        startsAt: { gte: todayEnd },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: { customer: true, service: true },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
    prisma.appointment.count({
      where: { staffId: user.staffId, status: "DONE", startsAt: { gte: monthStart } },
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title={`نوبت‌های ${user.name.split(" ")[0]}`}
        description="فقط نوبت‌هایی که به شما اختصاص داده شده نمایش داده می‌شود."
        action={
          <Link
            href="/admin/my/earnings"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--line)] px-5 text-sm font-medium transition-colors hover:bg-[color:var(--bg-elevated)]"
          >
            <Wallet className="size-4" />
            درآمد من
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MiniStat icon={CalendarDays} label="نوبت امروز" value={toFa(today.length)} />
        <MiniStat icon={Clock} label="نوبت پیش‌رو" value={toFa(upcoming.length)} />
        <MiniStat icon={Wallet} label="انجام‌شده در این ماه" value={toFa(doneThisMonth)} />
      </div>

      <Section title="امروز" appointments={today} empty="امروز نوبتی ندارید." />
      <div className="mt-8">
        <Section title="نوبت‌های پیش‌رو" appointments={upcoming} empty="نوبت پیش‌رویی ثبت نشده." />
      </div>
    </>
  );
}

type Row = {
  id: string;
  code: string;
  startsAt: Date;
  endsAt: Date;
  status: keyof typeof STATUS_META;
  customer: { firstName: string; lastName: string; phone: string };
  service: { title: string };
  note: string | null;
};

function Section({
  title,
  appointments,
  empty,
}: {
  title: string;
  appointments: Row[];
  empty: string;
}) {
  return (
    <>
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {appointments.length === 0 ? (
        <EmptyState icon={CalendarDays} title={empty} />
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <Card key={appt.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-32 shrink-0 flex-col items-center justify-center rounded-2xl bg-[color:var(--bg-sunken)] p-3">
                <p className="text-lg font-extrabold tabular-nums">{formatTime(appt.startsAt)}</p>
                <p className="text-[11px] text-[color:var(--fg-muted)]">
                  تا {formatTime(appt.endsAt)}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-bold">{appt.service.title}</p>
                <p className="mt-1 text-sm text-[color:var(--fg-muted)]">
                  {appt.customer.firstName} {appt.customer.lastName}
                  <a href={`tel:${appt.customer.phone}`} className="mr-2 hover:text-rose-500" dir="ltr">
                    {toFa(appt.customer.phone)}
                  </a>
                </p>
                <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                  {formatJalaliWithWeekday(appt.startsAt)} • کد {appt.code}
                </p>
                {appt.note && (
                  <p className="mt-2 rounded-xl bg-[color:var(--bg-sunken)] p-2.5 text-xs leading-6">
                    یادداشت مشتری: {appt.note}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Badge tone={STATUS_META[appt.status].tone}>{STATUS_META[appt.status].label}</Badge>
                <StatusSelect id={appt.id} value={appt.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xl font-extrabold">{value}</p>
        <p className="text-xs text-[color:var(--fg-muted)]">{label}</p>
      </div>
    </Card>
  );
}
