import Link from "next/link";
import {
  ArrowLeft, CalendarDays, CircleCheck, Clock, MessageSquare, TrendingUp, Users, Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { AppointmentsChart } from "@/components/admin/revenue-chart";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/appointment-status";
import { formatJalaliWithWeekday, formatTime, timeAgoFa } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getSession();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 29);

  const [
    todayCount, pendingCount, customerCount, monthRevenue,
    upcoming, recentMessages, monthlyAppointments,
  ] = await Promise.all([
    prisma.appointment.count({ where: { startsAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.appointment.count({ where: { status: "PENDING" } }),
    prisma.customer.count(),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", paidAt: { gte: monthStart } },
    }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { customer: true, service: true, staff: true },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
    prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.appointment.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { createdAt: true },
    }),
  ]);

  // نمودار ۱۴ روز اخیر
  const chartData = Array.from({ length: 14 }).map((_, i) => {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - (13 - i));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return {
      label: toFa(formatJalaliWithWeekday(day).split("، ")[1]?.split(" ")[0] ?? ""),
      count: monthlyAppointments.filter((a) => a.createdAt >= day && a.createdAt < next).length,
    };
  });

  const stats = [
    { icon: CalendarDays, label: "نوبت‌های امروز", value: toFa(todayCount), href: "/admin/appointments", tone: "rose" as const },
    { icon: Clock, label: "در انتظار تأیید", value: toFa(pendingCount), href: "/admin/appointments?status=PENDING", tone: "amber" as const },
    { icon: Users, label: "کل مشتریان", value: toFa(customerCount.toLocaleString("en-US")), href: "/admin/customers", tone: "plum" as const },
    { icon: Wallet, label: "درآمد ۳۰ روز اخیر", value: formatToman(monthRevenue._sum.amount ?? 0), href: "/admin/customers", tone: "green" as const },
  ];

  return (
    <>
      <AdminPageHeader
        title={`سلام ${user?.name.split(" ")[0]} 👋`}
        description="خلاصه‌ی وضعیت کلینیک در یک نگاه."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
          >
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white">
                <stat.icon className="size-5" />
              </span>
              <ArrowLeft className="size-4 text-[color:var(--fg-muted)] transition-transform group-hover:-translate-x-1" />
            </div>
            <p className="mt-5 text-2xl font-extrabold">{stat.value}</p>
            <p className="mt-1 text-xs text-[color:var(--fg-muted)]">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <TrendingUp className="size-[18px] text-rose-500" />
              نوبت‌های ثبت‌شده در ۱۴ روز اخیر
            </h2>
          </div>
          <AppointmentsChart data={chartData} />
        </Card>

        <Card>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <MessageSquare className="size-[18px] text-rose-500" />
              آخرین پیام‌ها
            </h2>
            <Link href="/admin/messages" className="text-xs text-rose-600 hover:underline dark:text-rose-300">
              همه
            </Link>
          </div>

          {recentMessages.length === 0 ? (
            <EmptyState icon={MessageSquare} title="پیامی ثبت نشده" />
          ) : (
            <ul className="space-y-3">
              {recentMessages.map((m) => (
                <li
                  key={m.id}
                  className="rounded-2xl border border-[color:var(--line)] p-4 transition-colors hover:bg-[color:var(--bg-sunken)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    {!m.isRead && <Badge tone="rose">جدید</Badge>}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-6 text-[color:var(--fg-muted)]">
                    {m.body}
                  </p>
                  <p className="mt-2 text-[11px] text-[color:var(--fg-muted)]">{timeAgoFa(m.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6" padded={false}>
        <div className="flex items-center justify-between border-b border-[color:var(--line)] p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <CircleCheck className="size-[18px] text-rose-500" />
            نوبت‌های پیش‌رو
          </h2>
          <Link
            href="/admin/appointments"
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:underline dark:text-rose-300"
          >
            مدیریت نوبت‌ها
            <ArrowLeft className="size-3.5" />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={CalendarDays} title="نوبت پیش‌رویی ثبت نشده" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-6 py-3 text-right font-medium">مشتری</th>
                  <th className="px-6 py-3 text-right font-medium">خدمت</th>
                  <th className="px-6 py-3 text-right font-medium">متخصص</th>
                  <th className="px-6 py-3 text-right font-medium">زمان</th>
                  <th className="px-6 py-3 text-right font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {upcoming.map((appt) => (
                  <tr key={appt.id} className="transition-colors hover:bg-[color:var(--bg-sunken)]">
                    <td className="px-6 py-4">
                      <p className="font-medium">
                        {appt.customer.firstName} {appt.customer.lastName}
                      </p>
                      <p className="text-xs text-[color:var(--fg-muted)]" dir="ltr">
                        {toFa(appt.customer.phone)}
                      </p>
                    </td>
                    <td className="px-6 py-4">{appt.service.title}</td>
                    <td className="px-6 py-4 text-[color:var(--fg-muted)]">{appt.staff?.name ?? "—"}</td>
                    <td className="px-6 py-4">
                      <p>{formatJalaliWithWeekday(appt.startsAt)}</p>
                      <p className="text-xs text-[color:var(--fg-muted)]">ساعت {formatTime(appt.startsAt)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={STATUS_META[appt.status].tone}>{STATUS_META[appt.status].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
