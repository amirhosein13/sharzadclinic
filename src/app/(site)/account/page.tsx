import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CalendarHeart, CalendarPlus, FileText, LogOut, Sparkles, User, Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";
import { customerLogout } from "@/app/actions/customer";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppointmentActions } from "@/components/site/appointment-actions";
import { ProfileForm } from "@/components/site/profile-form";
import { STATUS_META } from "@/lib/appointment-status";
import { formatJalaliLong, formatJalaliWithWeekday, formatTime } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "حساب من",
  robots: { index: false },
};

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login");

  const customer = await prisma.customer.findUnique({
    where: { id: session.id },
    include: {
      appointments: {
        include: { service: true, staff: { select: { name: true } } },
        orderBy: { startsAt: "desc" },
      },
      treatments: {
        include: { service: { select: { title: true } }, staff: { select: { name: true } } },
        orderBy: { performedAt: "desc" },
      },
      payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" } },
    },
  });

  if (!customer) redirect("/login");

  const now = new Date();
  const upcoming = customer.appointments.filter(
    (a) => a.startsAt >= now && (a.status === "PENDING" || a.status === "CONFIRMED")
  );
  const past = customer.appointments.filter((a) => !upcoming.includes(a));
  const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <PageHero
        eyebrow="حساب کاربری"
        title={`${customer.firstName} عزیز، خوش آمدید`}
        description="نوبت‌ها، پرونده‌ی درمانی و اطلاعات شخصی‌تان را اینجا می‌بینید."
      />

      <div className="container-page py-14">
        {/* آمار */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat icon={CalendarHeart} label="نوبت پیش‌رو" value={toFa(upcoming.length)} />
          <Stat icon={Sparkles} label="کل نوبت‌ها" value={toFa(customer.appointments.length)} />
          <Stat icon={FileText} label="جلسات پرونده" value={toFa(customer.treatments.length)} />
          <Stat icon={Wallet} label="مجموع پرداخت" value={formatToman(totalPaid)} />
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-10">
            {/* نوبت‌های پیش‌رو */}
            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold">نوبت‌های پیش‌رو</h2>
                <ButtonLink href="/booking" size="sm">
                  <CalendarPlus className="size-4" />
                  رزرو نوبت جدید
                </ButtonLink>
              </div>

              {upcoming.length === 0 ? (
                <EmptyBox text="در حال حاضر نوبت فعالی ندارید." />
              ) : (
                <div className="space-y-4">
                  {upcoming.map((appt) => (
                    <article
                      key={appt.id}
                      className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 shadow-soft"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{appt.service.title}</h3>
                          <p className="mt-1.5 text-sm text-[color:var(--fg-muted)]">
                            {formatJalaliWithWeekday(appt.startsAt)} — ساعت {formatTime(appt.startsAt)}
                          </p>
                          {appt.staff && (
                            <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                              متخصص: {appt.staff.name}
                            </p>
                          )}
                        </div>
                        <Badge tone={STATUS_META[appt.status].tone}>
                          {STATUS_META[appt.status].label}
                        </Badge>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-4">
                        <p className="text-xs text-[color:var(--fg-muted)]">
                          کد پیگیری: <span className="font-bold tracking-wider">{appt.code}</span>
                        </p>
                        <AppointmentActions
                          id={appt.id}
                          startsAt={appt.startsAt.toISOString()}
                          serviceTitle={appt.service.title}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* تاریخچه */}
            {past.length > 0 && (
              <section>
                <h2 className="mb-5 text-xl font-bold">تاریخچه‌ی نوبت‌ها</h2>
                <div className="overflow-hidden rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)]">
                  <ul className="divide-y divide-[color:var(--line)]">
                    {past.map((appt) => (
                      <li key={appt.id} className="flex items-center justify-between gap-4 p-5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{appt.service.title}</p>
                          <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                            {formatJalaliLong(appt.startsAt)} — ساعت {formatTime(appt.startsAt)}
                          </p>
                        </div>
                        <Badge tone={STATUS_META[appt.status].tone}>
                          {STATUS_META[appt.status].label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* پرونده‌ی درمانی */}
            {customer.treatments.length > 0 && (
              <section>
                <h2 className="mb-5 text-xl font-bold">پرونده‌ی درمانی</h2>
                <div className="overflow-hidden rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)]">
                  <ul className="divide-y divide-[color:var(--line)]">
                    {customer.treatments.map((t) => (
                      <li key={t.id} className="p-5">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-medium">{t.service?.title ?? "جلسه‌ی درمان"}</p>
                          <p className="shrink-0 text-xs text-[color:var(--fg-muted)]">
                            {formatJalaliLong(t.performedAt)}
                          </p>
                        </div>
                        {t.sessionNo && (
                          <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                            جلسه‌ی {toFa(t.sessionNo)}
                            {t.staff && ` • ${t.staff.name}`}
                          </p>
                        )}
                        {t.description && (
                          <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">
                            {t.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>

          {/* ستون کناری */}
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft">
              <h2 className="mb-5 flex items-center gap-2 font-bold">
                <User className="size-4 text-rose-500" />
                اطلاعات من
              </h2>
              <ProfileForm
                firstName={customer.firstName}
                lastName={customer.lastName}
                email={customer.email}
                phone={customer.phone}
              />
            </div>

            {customer.payments.length > 0 && (
              <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft">
                <h2 className="mb-5 font-bold">پرداخت‌های من</h2>
                <ul className="space-y-3">
                  {customer.payments.slice(0, 6).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-[color:var(--fg-muted)]">
                        {p.paidAt ? formatJalaliLong(p.paidAt) : "—"}
                      </span>
                      <span className="font-medium">{formatToman(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form action={customerLogout}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] px-5 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                <LogOut className="size-4" />
                خروج از حساب
              </button>
            </form>
          </aside>
        </div>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 text-center shadow-soft">
      <Icon className="mx-auto size-5 text-rose-500" />
      <p className="mt-3 text-xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-[color:var(--fg-muted)]">{label}</p>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-4xl border border-dashed border-[color:var(--line)] p-10 text-center">
      <CalendarHeart className="mx-auto size-8 text-rose-300" />
      <p className="mt-3 text-sm text-[color:var(--fg-muted)]">{text}</p>
      <ButtonLink href="/booking" className="mt-6">
        رزرو نوبت
      </ButtonLink>
    </div>
  );
}
