import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Camera, FileSignature, FileText, Package as PackageIcon, Phone, Star, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { CustomerNotes } from "@/components/admin/customer-notes";
import { CustomerForm } from "@/components/admin/forms/customer-form";
import { TreatmentForm } from "@/components/admin/forms/treatment-form";
import { WalkInForm } from "@/components/admin/forms/walkin-form";
import { WaitlistForm } from "@/components/admin/forms/waitlist-form";
import { ActionButton } from "@/components/admin/action-button";
import { deleteTreatment } from "@/app/actions/reception";
import { deleteConsentSignature } from "@/app/actions/consents";
import { revokePhotoConsent } from "@/app/actions/photos";
import { ConsentSignForm } from "@/components/admin/forms/consent-sign-form";
import { PackageForm } from "@/components/admin/forms/package-form";
import { PackageCard } from "@/components/admin/package-card";
import { CasePhotos } from "@/components/case-photos";
import { summarizePackages } from "@/lib/packages";
import { missingConsents, renderConsentBody } from "@/lib/consents";
import { noShowProfile } from "@/lib/no-shows";
import { aspectLabel } from "@/lib/feedback";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/appointment-status";
import { formatJalaliLong, formatJalaliWithWeekday, formatTime, toJalaliInput } from "@/lib/date";
import { getSession } from "@/lib/auth";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardPage("customers");
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      appointments: {
        include: { service: true, staff: true },
        orderBy: { startsAt: "desc" },
      },
      treatments: {
        include: { service: true, staff: true },
        orderBy: { performedAt: "desc" },
      },
      payments: { orderBy: { paidAt: "desc" } },
      consents: {
        include: { template: { select: { title: true } } },
        orderBy: { signedAt: "desc" },
      },
      feedbacks: {
        where: { submittedAt: { not: null } },
        include: { service: { select: { title: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!customer) notFound();

  const [services, staff, packages, consentTemplates, currentUser] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
      orderBy: { order: "asc" },
    }),
    prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
    }),
    summarizePackages(customer.id),
    prisma.consentTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        body: true,
        services: { select: { serviceId: true, service: { select: { title: true } } } },
      },
    }),
    getSession(),
  ]);

  const unsignedConsents = await missingConsents(customer.id);
  const noShow = await noShowProfile(customer.id);

  const packageOptions = packages
    .filter((p) => !p.isFinished && !p.isExpired)
    .map((p) => ({
      id: p.id,
      label: `${p.title} — ${toFa(p.remainingSessions)} جلسه باقی`,
    }));

  const canManageContent = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

  const canEditPackages =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "MANAGER" ||
    currentUser?.role === "RECEPTION";

  const fullName = `${customer.firstName} ${customer.lastName}`;

  // متن هر قالب با نام و تاریخ امروز آماده می‌شود تا منشی همان چیزی را
  // ببیند که امضا می‌شود
  // خدماتی که این مشتری واقعاً گرفته — مبنای «کدام رضایت‌نامه به کارش می‌آید»
  const customerServiceIds = new Set(
    customer.appointments
      .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
      .map((a) => a.serviceId),
  );
  const signedTemplateIds = new Set(customer.consents.map((c) => c.templateId));

  const consentOptions = await Promise.all(
    consentTemplates.map(async (t) => ({
      id: t.id,
      title: t.title,
      // عمومی (بدون خدمت) همیشه در دسترس است؛ مخصوص، فقط وقتی به کار این مشتری می‌آید
      relevant:
        t.services.length === 0 || t.services.some((x) => customerServiceIds.has(x.serviceId)),
      serviceTitles: t.services.map((x) => x.service.title),
      signed: signedTemplateIds.has(t.id),
      preview: await renderConsentBody(t.body, {
        fullName,
        nationalCode: customer.nationalCode,
      }),
    })),
  );
  // مربوط‌ها اول، و بینشان امضانشده‌ها جلوتر
  consentOptions.sort(
    (a, b) => Number(b.relevant) - Number(a.relevant) || Number(a.signed) - Number(b.signed),
  );

  const totalPaid = customer.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <Link
        href="/admin/customers"
        className="mb-5 inline-flex items-center gap-2 text-sm text-[color:var(--fg-muted)] transition-colors hover:text-rose-500"
      >
        <ArrowRight className="size-4" />
        بازگشت به لیست مشتریان
      </Link>

      {/* بدقولی: منشی باید پیش از دادن نوبت بعدی ببیندش */}
      {noShow.message && (
        <div
          className={
            noShow.risk === "high"
              ? "mb-6 rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-400/30 dark:bg-red-500/10"
              : "mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-400/30 dark:bg-amber-500/10"
          }
        >
          <p
            className={
              noShow.risk === "high"
                ? "flex items-center gap-2 text-sm font-bold text-red-800 dark:text-red-200"
                : "flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200"
            }
          >
            <TriangleAlert className="size-4 shrink-0" />
            {noShow.message}
          </p>
          <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
            در مجموع {toFa(noShow.total)} بار نوبت گرفته و نیامده است.
            {noShow.requiresDeposit && " رزرو آنلاینش هم فقط با پرداخت بیعانه قطعی می‌شود."}
          </p>
        </div>
      )}

      <AdminPageHeader
        title={fullName}
        description={`عضو از ${formatJalaliLong(customer.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <WalkInForm
              compact
              customerId={customer.id}
              customerName={fullName}
              services={services}
              staff={staff}
            />
            <TreatmentForm
              customerId={customer.id}
              customerName={fullName}
              services={services}
              staff={staff}
              packages={packageOptions}
            />
            <WaitlistForm
              customerId={customer.id}
              customerName={fullName}
              services={services}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr]">
        {/* اطلاعات */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-5 font-bold">اطلاعات تماس</h2>
            <dl className="space-y-4 text-sm">
              <Row label="موبایل" value={toFa(customer.phone)} ltr />
              {customer.email && <Row label="ایمیل" value={customer.email} ltr />}
              {customer.nationalCode && <Row label="کد ملی" value={toFa(customer.nationalCode)} />}
              {customer.birthDate && (
                <Row label="تاریخ تولد" value={formatJalaliLong(customer.birthDate)} />
              )}
              {customer.address && <Row label="آدرس" value={customer.address} />}
              {customer.legacyId && <Row label="شناسه‌ی قدیمی" value={customer.legacyId} ltr />}
            </dl>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--line)] pt-5">
              {customer.isBlocked && <Badge tone="red">محدودشده</Badge>}
              {customer.legacyId && <Badge tone="plum">منتقل‌شده از اپ قبلی</Badge>}
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-1.5 text-xs transition-colors hover:bg-[color:var(--bg-sunken)]"
              >
                <Phone className="size-3.5" />
                تماس
              </a>
              <CustomerForm
                customer={{
                  id: customer.id,
                  firstName: customer.firstName,
                  lastName: customer.lastName,
                  phone: customer.phone,
                  email: customer.email,
                  nationalCode: customer.nationalCode,
                  gender: customer.gender,
                  birthDate: customer.birthDate ? toJalaliInput(customer.birthDate) : null,
                  address: customer.address,
                  notes: customer.notes,
                  allergies: customer.allergies,
                  referralSource: customer.referralSource,
                  referralNote: customer.referralNote,
                }}
              />
            </div>
          </Card>

          {customer.allergies && (
            <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-500/5">
              <h2 className="mb-3 text-sm font-bold text-amber-800 dark:text-amber-200">
                ⚠️ حساسیت‌ها
              </h2>
              <p className="text-sm leading-7">{customer.allergies}</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-4 font-bold">یادداشت پذیرش</h2>
            <CustomerNotes id={customer.id} initial={customer.notes ?? ""} />
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={CalendarDays} label="نوبت" value={toFa(customer.appointments.length)} />
            <MiniStat icon={FileText} label="پرونده" value={toFa(customer.treatments.length)} />
            <MiniStat icon={Wallet} label="پرداخت" value={toFa(customer.payments.length)} />
          </div>
        </div>

        {/* تاریخچه */}
        <div className="space-y-6">
          <Card padded={false}>
            <h2 className="border-b border-[color:var(--line)] p-4 sm:p-6 font-bold">تاریخچه‌ی نوبت‌ها</h2>
            {customer.appointments.length === 0 ? (
              <div className="p-4 sm:p-6">
                <EmptyState icon={CalendarDays} title="نوبتی ثبت نشده" />
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--line)]">
                {customer.appointments.map((appt) => (
                  <li key={appt.id} className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{appt.service.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                        {formatJalaliWithWeekday(appt.startsAt)} — ساعت {formatTime(appt.startsAt)}
                        {appt.staff && ` • ${appt.staff.name}`}
                      </p>
                    </div>
                    <Badge tone={STATUS_META[appt.status].tone}>{STATUS_META[appt.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* پکیج‌های جلسات */}
          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] p-4 sm:p-6">
              <h2 className="flex items-center gap-2 font-bold">
                <PackageIcon className="size-[18px] text-gold-600" />
                پکیج جلسات
                <span className="text-xs font-normal text-[color:var(--fg-muted)]">
                  ({toFa(packages.length)} دوره)
                </span>
              </h2>
              {canEditPackages && (
                <PackageForm customerId={customer.id} customerName={fullName} services={services} />
              )}
            </div>

            {packages.length === 0 ? (
              <div className="p-4 sm:p-6">
                <EmptyState
                  icon={PackageIcon}
                  title="پکیجی ثبت نشده"
                  description="دوره‌های چندجلسه‌ای مثل «۶ جلسه لیزر» را اینجا ثبت کنید تا جلسات باقی‌مانده خودکار شمرده شود."
                />
              </div>
            ) : (
              <div className="space-y-4 p-4 sm:p-6">
                {packages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    customerId={customer.id}
                    customerName={fullName}
                    services={services}
                    canEdit={canEditPackages}
                    pkg={{
                      id: pkg.id,
                      title: pkg.title,
                      serviceTitle: pkg.serviceTitle,
                      serviceId: pkg.serviceId,
                      totalSessions: pkg.totalSessions,
                      usedSessions: pkg.usedSessions,
                      remainingSessions: pkg.remainingSessions,
                      price: pkg.price,
                      paidAmount: pkg.paidAmount,
                      remainingAmount: pkg.remainingAmount,
                      purchasedAt: pkg.purchasedAt.toISOString(),
                      expiresAt: pkg.expiresAt?.toISOString() ?? null,
                      expiresAtJalali: pkg.expiresAt ? toJalaliInput(pkg.expiresAt) : null,
                      isExpired: pkg.isExpired,
                      isFinished: pkg.isFinished,
                      note: pkg.note,
                    }}
                  />
                ))}
              </div>
            )}
          </Card>

          {customer.feedbacks.length > 0 && (
            <Card padded={false}>
              <h2 className="border-b border-[color:var(--line)] p-4 sm:p-6 font-bold">
                نظرهای این مشتری
                <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                  ({toFa(customer.feedbacks.length)} نظر)
                </span>
              </h2>
              <ul className="divide-y divide-[color:var(--line)]">
                {customer.feedbacks.map((f) => (
                  <li key={f.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {f.service?.title ?? "خدمت نامشخص"}
                        <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                          {f.submittedAt ? formatJalaliLong(f.submittedAt) : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-0.5">
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

                    {(f.goodTags.length > 0 || f.badTags.length > 0) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {f.badTags.map((t) => (
                          <span
                            key={`b-${t}`}
                            className="rounded-lg bg-red-50 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-500/10 dark:text-red-300"
                          >
                            ✕ {aspectLabel(t)}
                          </span>
                        ))}
                        {f.goodTags.map((t) => (
                          <span
                            key={`g-${t}`}
                            className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          >
                            ✓ {aspectLabel(t)}
                          </span>
                        ))}
                      </div>
                    )}

                    {f.comment && (
                      <p className="mt-2.5 rounded-xl bg-[color:var(--bg-sunken)] p-3 text-sm leading-7 text-[color:var(--fg-muted)]">
                        «{f.comment}»
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] p-4 sm:p-6">
              <h2 className="font-bold">
                رضایت‌نامه‌ها
                <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                  ({toFa(customer.consents.length)} امضا)
                </span>
              </h2>
              {consentOptions.length > 0 && canEditPackages && (
                <ConsentSignForm
                  customerId={customer.id}
                  customerName={fullName}
                  nationalCode={customer.nationalCode}
                  templates={consentOptions}
                />
              )}
            </div>

            {/* وضعیت اجازه‌ی انتشار عکس، کنار خود رضایت‌نامه‌ها */}
            {customer.photoPublishAllowed !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] px-6 py-4">
                <p className="flex items-center gap-2 text-sm">
                  <Camera className="size-4 shrink-0 text-[color:var(--fg-muted)]" />
                  {customer.photoPublishAllowed
                    ? "اجازه‌ی انتشار عکس قبل/بعد را داده است"
                    : "اجازه‌ی انتشار عکس نداده یا پس گرفته است"}
                </p>
                {customer.photoPublishAllowed && canEditPackages && (
                  <ActionButton
                    action={revokePhotoConsent.bind(null, customer.id)}
                    confirm="اجازه‌ی انتشار پس گرفته شود؟ عکس‌های این مشتری از سایت برداشته می‌شوند."
                    className="text-xs"
                  >
                    پس‌گرفتن اجازه
                  </ActionButton>
                )}
              </div>
            )}

            {unsignedConsents.length > 0 && (
              <div className="border-b border-[color:var(--line)] bg-amber-50 p-5 dark:bg-amber-500/10">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200">
                  <TriangleAlert className="size-4 shrink-0" />
                  رضایت‌نامه‌ی امضانشده
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {unsignedConsents.map((m) => (
                    <li key={m.templateId} className="text-xs leading-6 text-amber-800 dark:text-amber-200">
                      «{m.templateTitle}» برای {m.serviceTitles.join("، ")}
                      {m.upcoming && <b> — نوبت پیش‌رو دارد</b>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {customer.consents.length === 0 ? (
              <div className="p-4 sm:p-6">
                <EmptyState
                  icon={FileSignature}
                  title="رضایت‌نامه‌ای امضا نشده"
                  description={
                    consentOptions.length === 0
                      ? "اول از بخش «رضایت‌نامه‌ها» یک متن بسازید."
                      : "پیش از شروع درمان، متن را با مراجعه‌کننده بخوانید و امضا بگیرید."
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--line)]">
                {customer.consents.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.template.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                        {c.fullName} • {formatJalaliLong(c.signedAt)}
                        {c.signatureData ? " • با امضا" : " • بدون امضای تصویری"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/admin/print/consent/${c.id}`}
                        target="_blank"
                        className="rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
                      >
                        مشاهده و چاپ
                      </Link>
                      {canManageContent && (
                        <ActionButton
                          action={deleteConsentSignature.bind(null, c.id)}
                          confirm="این رضایت‌نامه‌ی امضاشده حذف شود؟"
                          title="حذف رضایت‌نامه"
                          className="size-8 p-0 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] p-4 sm:p-6">
              <h2 className="font-bold">
                پرونده‌ی درمانی
                <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                  ({toFa(customer.treatments.length)} جلسه)
                </span>
              </h2>
              <TreatmentForm
                customerId={customer.id}
                customerName={fullName}
                services={services}
                staff={staff}
                packages={packageOptions}
              />
            </div>

            {customer.treatments.length === 0 ? (
              <div className="p-4 sm:p-6">
                <EmptyState
                  icon={FileText}
                  title="سابقه‌ای ثبت نشده"
                  description="مراجعات گذشته و پرونده‌های کاغذی را با دکمه‌ی بالا وارد کنید."
                />
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--line)]">
                {customer.treatments.map((t) => (
                  <li key={t.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.service?.title ?? "خدمت نامشخص"}</p>
                        {(t.sessionNo || t.staff) && (
                          <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                            {t.sessionNo ? `جلسه‌ی ${toFa(t.sessionNo)}` : ""}
                            {t.sessionNo && t.staff ? " • " : ""}
                            {t.staff?.name ?? ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-[color:var(--fg-muted)]">
                          {formatJalaliLong(t.performedAt)}
                        </span>
                        <TreatmentForm
                          customerId={customer.id}
                          customerName={fullName}
                          services={services}
                          staff={staff}
                          packages={packageOptions}
                          record={{
                            id: t.id,
                            serviceId: t.serviceId,
                            packageId: t.packageId,
                            staffId: t.staffId,
                            performedAt: toJalaliInput(t.performedAt),
                            sessionNo: t.sessionNo,
                            description: t.description,
                            beforePhoto: t.beforePhoto,
                            afterPhoto: t.afterPhoto,
                          }}
                        />
                        <ActionButton
                          action={deleteTreatment.bind(null, t.id)}
                          confirm="این سابقه حذف شود؟"
                          title="حذف سابقه"
                          className="size-8 p-0 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      </div>
                    </div>
                    {t.description && (
                      <p className="mt-2 rounded-xl bg-[color:var(--bg-sunken)] p-3 text-sm leading-7 text-[color:var(--fg-muted)]">
                        {t.description}
                      </p>
                    )}
                    <CasePhotos
                      before={t.beforePhoto}
                      after={t.afterPhoto}
                      caption={`${t.service?.title ?? "خدمت نامشخص"} — ${formatJalaliLong(t.performedAt)}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {customer.payments.length > 0 && (
            <Card padded={false}>
              <div className="flex items-center justify-between border-b border-[color:var(--line)] p-4 sm:p-6">
                <h2 className="font-bold">پرداخت‌ها</h2>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-300">
                  مجموع: {formatToman(totalPaid)}
                </p>
              </div>
              <ul className="divide-y divide-[color:var(--line)]">
                {customer.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 p-5">
                    <div>
                      <p className="text-sm font-medium">
                        {formatToman(p.amount)}
                        {p.status !== "PAID" && (
                          <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                            ({PAYMENT_STATUS_LABELS[p.status] ?? p.status})
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                        {p.paidAt ? formatJalaliLong(p.paidAt) : "در انتظار پرداخت"} •{" "}
                        {PAYMENT_LABELS[p.method] ?? p.method}
                      </p>
                    </div>
                    {p.reference && (
                      <span className="font-mono text-xs text-[color:var(--fg-muted)]">{p.reference}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پرداخت",
  PAID: "پرداخت‌شده",
  FAILED: "ناموفق",
  REFUNDED: "مسترد شده",
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "نقدی",
  CARD: "کارت‌خوان",
  ONLINE: "آنلاین",
  OTHER: "سایر",
};

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-xs text-[color:var(--fg-muted)]">{label}</dt>
      <dd className={`min-w-0 flex-1 leading-7 ${ltr ? "text-right" : ""}`} dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
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
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-4 text-center">
      <Icon className="mx-auto size-4 text-rose-500" />
      <p className="mt-2 text-lg font-extrabold">{value}</p>
      <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
    </div>
  );
}
