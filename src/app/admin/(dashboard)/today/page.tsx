import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardList, Clock, PartyPopper, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card } from "@/components/admin/page-header";
import { TaskCheck } from "@/components/admin/task-check";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/appointment-status";
import { REPEAT_LABELS, daysLate, dayKey, tasksForUser } from "@/lib/duties";
import { formatJalaliWithWeekday, formatTime } from "@/lib/date";
import { can } from "@/lib/permissions";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * «کارهای امروز من» — صفحه‌ی خانه‌ی هر کارمند.
 *
 * هدفش یک چیز است: کسی که صبح وارد پنل می‌شود، بدون پرسیدن از کسی
 * بفهمد امروز چه کاری گردنش است. پس همه‌چیزِ غیرضروری از اینجا
 * بیرون است — نه نمودار، نه آمار کلینیک. فقط کارها و نوبت‌های خودش.
 */
export default async function TodayPage() {
  const user = await guardPage("today");
  const today = dayKey();

  const { today: todayTasks, overdue } = await tasksForUser(user.id, today);

  // نوبت‌های امروزِ خودش — فقط اگر حسابش به پرسنلی وصل باشد
  const appointments = user.staffId
    ? await prisma.appointment.findMany({
        where: {
          staffId: user.staffId,
          startsAt: { gte: today, lt: new Date(today.getTime() + 86_400_000) },
        },
        include: { customer: { select: { firstName: true, lastName: true, phone: true } }, service: { select: { title: true } } },
        orderBy: { startsAt: "asc" },
      })
    : [];

  const open = todayTasks.filter((t) => t.status === "OPEN");
  const done = todayTasks.filter((t) => t.status === "DONE");
  const allDone = todayTasks.length > 0 && open.length === 0 && overdue.length === 0;

  const firstName = user.name.split(" ")[0];

  return (
    <>
      <AdminPageHeader
        title={`سلام ${firstName}`}
        description={formatJalaliWithWeekday(today)}
        action={
          can(user.role, "payroll.own") ? (
            <Link
              href="/admin/my/earnings"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--line)] px-5 text-sm font-medium transition-colors hover:bg-[color:var(--bg-elevated)]"
            >
              <Wallet className="size-4" />
              درآمد من
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MiniStat icon={ClipboardList} label="کار باز امروز" value={toFa(open.length)} />
        <MiniStat icon={CheckCircle2} label="انجام‌شده" value={toFa(done.length)} />
        <MiniStat icon={CalendarDays} label="نوبت امروز" value={toFa(appointments.length)} />
      </div>

      {allDone && (
        <Card className="mb-6 border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-500/5">
          <p className="flex items-center gap-3 text-sm font-medium">
            <PartyPopper className="size-5 shrink-0 text-emerald-600" />
            همه‌ی کارهای امروز انجام شد. دستت درد نکند.
          </p>
        </Card>
      )}

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-amber-700 dark:text-amber-300">
            مانده از روزهای قبل ({toFa(overdue.length)})
          </h2>
          <div className="space-y-2.5">
            {overdue.map((task) => (
              <TaskCheck
                key={task.id}
                id={task.id}
                done={false}
                title={task.title}
                note={task.note}
                meta={task.duty ? REPEAT_LABELS[task.duty.repeat] : "کار سپرده‌شده"}
                late={`${toFa(daysLate(task.dueOn, today))} روز عقب`}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">کارهای امروز</h2>
        {todayTasks.length === 0 ? (
          <Card>
            <p className="text-sm leading-7 text-[color:var(--fg-muted)]">
              امروز کاری برای شما ثبت نشده.
              {can(user.role, "duties") ? (
                <>
                  {" "}
                  از{" "}
                  <Link href="/admin/duties" className="font-medium text-[color:var(--fg)] underline">
                    بخش مسئولیت‌ها
                  </Link>{" "}
                  می‌توانید کارهای تکرارشونده‌ی هر نفر را تعریف کنید.
                </>
              ) : (
                " اگر فکر می‌کنید اشتباهی است، از مدیر بپرسید."
              )}
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {[...open, ...done].map((task) => (
              <TaskCheck
                key={task.id}
                id={task.id}
                done={task.status === "DONE"}
                title={task.title}
                note={task.note}
                meta={
                  task.duty?.timeHint ||
                  (task.duty ? REPEAT_LABELS[task.duty.repeat] : "کار سپرده‌شده")
                }
              />
            ))}
          </div>
        )}
      </section>

      {user.staffId && (
        <section>
          <h2 className="mb-3 text-lg font-bold">نوبت‌های امروز شما</h2>
          {appointments.length === 0 ? (
            <Card>
              <p className="text-sm text-[color:var(--fg-muted)]">امروز نوبتی به نام شما ثبت نشده.</p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {appointments.map((appt) => (
                <Card key={appt.id} className="flex flex-wrap items-center gap-4">
                  <span className="flex min-w-24 shrink-0 flex-col items-center rounded-2xl bg-[color:var(--bg-sunken)] p-2.5">
                    <span className="text-base font-extrabold tabular-nums">
                      {formatTime(appt.startsAt)}
                    </span>
                    <span className="text-[11px] text-[color:var(--fg-muted)]">
                      تا {formatTime(appt.endsAt)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{appt.service.title}</span>
                    <span className="mt-0.5 block text-xs text-[color:var(--fg-muted)]">
                      {appt.customer.firstName} {appt.customer.lastName}
                      <a
                        href={`tel:${appt.customer.phone}`}
                        className="mr-2 hover:text-rose-500"
                        dir="ltr"
                      >
                        {toFa(appt.customer.phone)}
                      </a>
                    </span>
                  </span>
                  <Badge tone={STATUS_META[appt.status].tone}>
                    {STATUS_META[appt.status].label}
                  </Badge>
                </Card>
              ))}
            </div>
          )}
          {/* «نوبت‌های من» مجوز جدا دارد؛ بدون این شرط ممکن بود لینکی
              نشان دهیم که کلیک رویش کاربر را برمی‌گرداند */}
          {can(user.role, "appointments.own") && (
            <Link
              href="/admin/my"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--fg-muted)] underline hover:text-[color:var(--fg)]"
            >
              <Clock className="size-3.5" />
              دیدن همه‌ی نوبت‌های پیش‌رو
            </Link>
          )}
        </section>
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
