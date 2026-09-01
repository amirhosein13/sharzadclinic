import Link from "next/link";
import { CalendarDays, Search, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { StatusSelect } from "@/components/admin/status-select";
import { ActionButton } from "@/components/admin/action-button";
import { PaymentForm } from "@/components/admin/forms/payment-form";
import { deleteAppointment } from "@/app/actions/admin";
import { STATUS_META, STATUS_ORDER } from "@/lib/appointment-status";
import { formatJalaliWithWeekday, formatTime } from "@/lib/date";
import { cn, toFa } from "@/lib/utils";
import type { AppointmentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; when?: string }>;
}) {
  await guardPage("appointments.all");
  const { status, q, page: pageParam, when } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const where = {
    ...(status && STATUS_ORDER.includes(status as AppointmentStatus)
      ? { status: status as AppointmentStatus }
      : {}),
    ...(when === "today" ? { startsAt: { gte: todayStart, lt: todayEnd } } : {}),
    ...(when === "upcoming" ? { startsAt: { gte: now } } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q.toUpperCase() } },
            { customer: { phone: { contains: q } } },
            { customer: { firstName: { contains: q, mode: "insensitive" as const } } },
            { customer: { lastName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [appointments, total, counts] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        customer: true,
        service: true,
        staff: true,
        payments: { where: { status: "PAID" }, select: { amount: true } },
      },
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.appointment.count({ where }),
    prisma.appointment.groupBy({ by: ["status"], _count: true }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const countFor = (s: AppointmentStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, q, when, page: undefined as string | undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const query = params.toString();
    return `/admin/appointments${query ? `?${query}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title="مدیریت نوبت‌ها"
        description={`مجموع ${toFa(total)} نوبت با فیلتر فعلی.`}
      />

      <Card className="mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--fg-muted)]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="جستجو بر اساس کد پیگیری، نام یا شماره موبایل..."
              className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] py-3 pr-11 pl-4 text-sm focus:border-rose-400 focus:outline-none"
            />
          </div>
          {status && <input type="hidden" name="status" value={status} />}
          {when && <input type="hidden" name="when" value={when} />}
          <button
            type="submit"
            className="rounded-2xl bg-rose-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-600"
          >
            جستجو
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterLink href={buildHref({ status: undefined, when: undefined })} active={!status && !when}>
            همه
          </FilterLink>
          <FilterLink href={buildHref({ when: "today", status: undefined })} active={when === "today"}>
            امروز
          </FilterLink>
          <FilterLink href={buildHref({ when: "upcoming", status: undefined })} active={when === "upcoming"}>
            پیش‌رو
          </FilterLink>
          {STATUS_ORDER.map((s) => (
            <FilterLink key={s} href={buildHref({ status: s, when: undefined })} active={status === s}>
              {STATUS_META[s].label}
              <span className="mr-1.5 opacity-70">({toFa(countFor(s))})</span>
            </FilterLink>
          ))}
        </div>
      </Card>

      {appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="نوبتی با این فیلتر پیدا نشد"
          description="فیلترها را تغییر دهید یا عبارت جستجو را بردارید."
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-right font-medium">کد</th>
                  <th className="px-5 py-3 text-right font-medium">مشتری</th>
                  <th className="px-5 py-3 text-right font-medium">خدمت</th>
                  <th className="px-5 py-3 text-right font-medium">متخصص</th>
                  <th className="px-5 py-3 text-right font-medium">زمان</th>
                  <th className="px-5 py-3 text-right font-medium">وضعیت</th>
                  <th className="px-5 py-3 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="transition-colors hover:bg-[color:var(--bg-sunken)]">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold tracking-wider">{appt.code}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/customers/${appt.customerId}`}
                        className="font-medium hover:text-rose-500"
                      >
                        {appt.customer.firstName} {appt.customer.lastName}
                      </Link>
                      <p className="text-xs text-[color:var(--fg-muted)]" dir="ltr">
                        {toFa(appt.customer.phone)}
                      </p>
                    </td>
                    <td className="px-5 py-4">{appt.service.title}</td>
                    <td className="px-5 py-4 text-[color:var(--fg-muted)]">{appt.staff?.name ?? "—"}</td>
                    <td className="px-5 py-4">
                      <p className="whitespace-nowrap">{formatJalaliWithWeekday(appt.startsAt)}</p>
                      <p className="text-xs text-[color:var(--fg-muted)]">
                        {formatTime(appt.startsAt)} تا {formatTime(appt.endsAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusSelect id={appt.id} value={appt.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <PaymentForm
                          appointmentId={appt.id}
                          code={appt.code}
                          serviceTitle={appt.service.title}
                          suggestedAmount={appt.service.priceFrom}
                          paidTotal={appt.payments.reduce((sum, p) => sum + p.amount, 0)}
                        />
                      <ActionButton
                        action={deleteAppointment.bind(null, appt.id)}
                        confirm={`نوبت ${appt.code} حذف شود؟ این کار برگشت‌پذیر نیست.`}
                        title="حذف نوبت"
                        className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[color:var(--line)] px-5 py-4 text-sm">
              <p className="text-xs text-[color:var(--fg-muted)]">
                صفحه {toFa(page)} از {toFa(totalPages)}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildHref({ page: String(page - 1) })}
                    className="rounded-xl border border-[color:var(--line)] px-4 py-2 text-xs transition-colors hover:bg-[color:var(--bg-sunken)]"
                  >
                    قبلی
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildHref({ page: String(page + 1) })}
                    className="rounded-xl border border-[color:var(--line)] px-4 py-2 text-xs transition-colors hover:bg-[color:var(--bg-sunken)]"
                  >
                    بعدی
                  </Link>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl border px-4 py-2 text-xs font-medium transition-colors",
        active
          ? "border-rose-500 bg-rose-500 text-white"
          : "border-[color:var(--line)] hover:border-rose-300 hover:text-rose-500"
      )}
    >
      {children}
    </Link>
  );
}
