import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarHeart, CalendarPlus, FileSignature, FileText, LogOut, Package as PackageIcon, Sparkles, Star, User, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";
import { activePackages } from "@/lib/packages";
import { getSettings } from "@/lib/settings";
import { referralSummary } from "@/lib/referrals";
import { ReferralCard } from "@/components/site/referral-card";
import { isZarinpalConfigured } from "@/lib/zarinpal";
import { customerLogout } from "@/app/actions/customer";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppointmentActions } from "@/components/site/appointment-actions";
import { DepositButton } from "@/components/site/deposit-button";
import { ProfileForm } from "@/components/site/profile-form";
import { CasePhotos } from "@/components/case-photos";
import { TicketPanel } from "@/components/site/ticket-panel";
import { TICKET_CATEGORIES, TICKET_STATUS_META, ticketCategoryLabel } from "@/lib/tickets";
import { STATUS_META } from "@/lib/appointment-status";
import {
  formatJalaliDateTime, formatJalaliLong, formatJalaliWithWeekday, formatTime, timeAgoFa,
} from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "حساب من",
  robots: { index: false },
};

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login");

  const settings = await getSettings();
  const referral = await referralSummary(session.id);
  const depositPercent = Number(settings.depositPercent) || 30;
  const gatewayReady = isZarinpalConfigured();

  const customer = await prisma.customer.findUnique({
    where: { id: session.id },
    include: {
      appointments: {
        include: {
          service: true,
          staff: { select: { name: true } },
          payments: { where: { status: "PAID" }, select: { amount: true } },
        },
        orderBy: { startsAt: "desc" },
      },
      treatments: {
        include: { service: { select: { title: true } }, staff: { select: { name: true } } },
        orderBy: { performedAt: "desc" },
      },
      payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" } },
      consents: {
        include: { template: { select: { title: true } } },
        orderBy: { signedAt: "desc" },
      },
      feedbacks: {
        where: { submittedAt: { not: null } },
        include: { service: { select: { title: true } } },
        orderBy: { submittedAt: "desc" },
        take: 10,
      },
      tickets: {
        include: {
          messages: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!customer) redirect("/login");

  const packages = await activePackages(customer.id);

  const now = new Date();
  const upcoming = customer.appointments.filter(
    (a) => a.startsAt >= now && (a.status === "PENDING" || a.status === "CONFIRMED")
  );
  const past = customer.appointments.filter((a) => !upcoming.includes(a));
  const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);

  // خط زمانی مراجعات: پرونده‌ی درمانی به‌علاوه‌ی نوبت‌های انجام‌شده‌ای که
  // سابقه‌ی جداگانه‌ای برایشان ثبت نشده، تا هیچ مراجعه‌ای جا نیفتد
  type Visit = {
    key: string;
    kind: "treatment" | "appointment";
    date: Date;
    title: string;
    staffName: string | null;
    sessionNo: number | null;
    description: string | null;
    beforePhoto?: string | null;
    afterPhoto?: string | null;
    badge?: { label: string; tone: "rose" | "plum" };
  };

  const treatmentDays = new Set(
    customer.treatments.map((t) => t.performedAt.toDateString())
  );

  const visits: Visit[] = [
    ...customer.treatments.map((t) => ({
      key: `t-${t.id}`,
      kind: "treatment" as const,
      date: t.performedAt,
      title: t.service?.title ?? "جلسه‌ی درمان",
      staffName: t.staff?.name ?? null,
      sessionNo: t.sessionNo,
      description: t.description,
      beforePhoto: t.beforePhoto,
      afterPhoto: t.afterPhoto,
      badge: { label: "ثبت در پرونده", tone: "rose" as const },
    })),
    ...customer.appointments
      .filter((a) => a.status === "DONE" && !treatmentDays.has(a.startsAt.toDateString()))
      .map((a) => ({
        key: `a-${a.id}`,
        kind: "appointment" as const,
        date: a.startsAt,
        title: a.service.title,
        staffName: a.staff?.name ?? null,
        sessionNo: null,
        description: null,
        badge: { label: "نوبت انجام‌شده", tone: "plum" as const },
      })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const ticketViews = customer.tickets.map((t) => {
    const meta = TICKET_STATUS_META[t.status];
    return {
      id: t.id,
      subject: t.subject,
      categoryLabel: ticketCategoryLabel(t.category),
      status: t.status,
      statusLabel: meta.label,
      statusTone: meta.tone,
      hasUnread: t.unreadByCustomer,
      updatedLabel: timeAgoFa(t.updatedAt),
      messages: t.messages.map((m) => ({
        id: m.id,
        fromClinic: m.sender === "STAFF",
        body: m.body,
        timeLabel: formatJalaliDateTime(m.createdAt),
        authorName: m.user?.name ?? null,
      })),
    };
  });

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
          <Stat icon={FileText} label="مراجعه" value={toFa(visits.length)} />
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
                        <div className="flex flex-wrap items-center gap-2">
                          {gatewayReady &&
                            appt.payments.length === 0 &&
                            !!appt.service.priceFrom &&
                            Math.round((appt.service.priceFrom * depositPercent) / 100) >= 1000 && (
                              <DepositButton
                                appointmentId={appt.id}
                                amount={Math.round((appt.service.priceFrom * depositPercent) / 100)}
                              />
                            )}
                          {appt.payments.length > 0 && (
                            <Badge tone="green">بیعانه پرداخت شد</Badge>
                          )}
                          <AppointmentActions
                            id={appt.id}
                            startsAt={appt.startsAt.toISOString()}
                            serviceTitle={appt.service.title}
                          />
                        </div>
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

            {/* پکیج‌های فعال */}
            {packages.length > 0 && (
              <section>
                <h2 className="mb-5 text-xl font-bold">دوره‌های فعال شما</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="rounded-4xl border border-gold-500/40 bg-gold-500/5 p-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold">{pkg.title}</h3>
                        <PackageIcon className="size-5 shrink-0 text-gold-600" />
                      </div>

                      <p className="mt-4 text-3xl font-extrabold text-gold-600 dark:text-gold-300">
                        {toFa(pkg.remainingSessions)}
                        <span className="mr-1.5 text-sm font-normal text-[color:var(--fg-muted)]">
                          جلسه باقی‌مانده
                        </span>
                      </p>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--line)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-gold-500 to-rose-400"
                          style={{
                            width: `${Math.min(100, (pkg.usedSessions / pkg.totalSessions) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[color:var(--fg-muted)]">
                        {toFa(pkg.usedSessions)} از {toFa(pkg.totalSessions)} جلسه انجام شده
                        {pkg.expiresAt && ` • تا ${formatJalaliLong(pkg.expiresAt)}`}
                      </p>

                      {pkg.remainingAmount > 0 && (
                        <p className="mt-3 border-t border-gold-500/25 pt-3 text-xs text-[color:var(--fg-muted)]">
                          مانده‌ی پرداخت: {formatToman(pkg.remainingAmount)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <TicketPanel tickets={ticketViews} categories={[...TICKET_CATEGORIES]} />

            {/* خط زمانی مراجعات */}
            {visits.length > 0 && (
              <section>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold">سوابق مراجعه‌ی شما</h2>
                  <span className="text-xs text-[color:var(--fg-muted)]">
                    {toFa(visits.length)} مراجعه
                  </span>
                </div>

                <ol className="relative space-y-5 border-r-2 border-[color:var(--line)] pr-6">
                  {visits.map((visit) => (
                    <li key={visit.key} className="relative">
                      <span
                        className={
                          visit.kind === "treatment"
                            ? "absolute -right-[1.9rem] top-5 size-3.5 rounded-full border-2 border-[color:var(--bg)] bg-rose-500"
                            : "absolute -right-[1.9rem] top-5 size-3.5 rounded-full border-2 border-[color:var(--bg)] bg-plum-400"
                        }
                      />
                      <article className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5 shadow-soft">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{visit.title}</h3>
                            <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                              {formatJalaliWithWeekday(visit.date)}
                              {visit.staffName && ` • ${visit.staffName}`}
                              {visit.sessionNo ? ` • جلسه‌ی ${toFa(visit.sessionNo)}` : ""}
                            </p>
                          </div>
                          {visit.badge && <Badge tone={visit.badge.tone}>{visit.badge.label}</Badge>}
                        </div>

                        {visit.description && (
                          <p className="mt-3 rounded-2xl bg-[color:var(--bg-sunken)] p-3.5 text-sm leading-7 text-[color:var(--fg-muted)]">
                            {visit.description}
                          </p>
                        )}

                        <CasePhotos
                          before={visit.beforePhoto}
                          after={visit.afterPhoto}
                          caption={`${visit.title} — ${formatJalaliWithWeekday(visit.date)}`}
                        />
                      </article>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          {/* ستون کناری */}
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            {referral && (
              <ReferralCard
                summary={referral}
                referredReward={Number(settings.referredReward) || 0}
              />
            )}

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

            {customer.feedbacks.length > 0 && (
              <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft">
                <h2 className="mb-2 font-bold">نظرهای من</h2>
                <p className="mb-5 text-xs leading-6 text-[color:var(--fg-muted)]">
                  آنچه ثبت کرده‌اید و اینکه کلینیک با آن چه کرده است.
                </p>
                <ul className="space-y-4">
                  {customer.feedbacks.map((f) => (
                    <li key={f.id} className="rounded-2xl border border-[color:var(--line)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {f.service?.title ?? "مراجعه"}
                        </span>
                        <span className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={
                                i < (f.rating ?? 0)
                                  ? "size-3.5 fill-gold-400 text-gold-400"
                                  : "size-3.5 text-[color:var(--line)]"
                              }
                            />
                          ))}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-[color:var(--fg-muted)]">
                        {f.submittedAt ? formatJalaliLong(f.submittedAt) : ""}
                        {" • "}
                        {f.status === "RESOLVED"
                          ? "رسیدگی شد"
                          : f.status === "SEEN"
                            ? "دیده شد"
                            : "ثبت شد"}
                      </p>

                      {f.replyToCustomer && (
                        <p className="mt-3 rounded-xl bg-[color:var(--bg-sunken)] p-3 text-xs leading-7">
                          <span className="font-medium">پاسخ کلینیک: </span>
                          {f.replyToCustomer}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {customer.consents.length > 0 && (
              <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft">
                <h2 className="mb-2 font-bold">رضایت‌نامه‌های من</h2>
                <p className="mb-5 text-xs leading-6 text-[color:var(--fg-muted)]">
                  متن‌هایی که پیش از درمان امضا کرده‌اید و همیشه در دسترس شماست.
                </p>
                <ul className="space-y-3">
                  {customer.consents.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/account/consent/${c.id}`}
                        target="_blank"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] p-3.5 text-sm transition-colors hover:border-rose-300 hover:bg-[color:var(--bg-sunken)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.template.title}</span>
                          <span className="mt-0.5 block text-xs text-[color:var(--fg-muted)]">
                            {formatJalaliLong(c.signedAt)}
                          </span>
                        </span>
                        <FileSignature className="size-4 shrink-0 text-rose-500" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
