import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, FileText, Phone, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { CustomerNotes } from "@/components/admin/customer-notes";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/appointment-status";
import { formatJalaliLong, formatJalaliWithWeekday, formatTime } from "@/lib/date";
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
    },
  });

  if (!customer) notFound();

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

      <AdminPageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        description={`عضو از ${formatJalaliLong(customer.createdAt)}`}
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
            <h2 className="border-b border-[color:var(--line)] p-6 font-bold">تاریخچه‌ی نوبت‌ها</h2>
            {customer.appointments.length === 0 ? (
              <div className="p-6">
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

          {customer.treatments.length > 0 && (
            <Card padded={false}>
              <h2 className="border-b border-[color:var(--line)] p-6 font-bold">
                پرونده‌ی درمانی
                <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                  (شامل سوابق منتقل‌شده از اپلیکیشن قبلی)
                </span>
              </h2>
              <ul className="divide-y divide-[color:var(--line)]">
                {customer.treatments.map((t) => (
                  <li key={t.id} className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium">{t.service?.title ?? "خدمت نامشخص"}</p>
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
                      <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">{t.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {customer.payments.length > 0 && (
            <Card padded={false}>
              <div className="flex items-center justify-between border-b border-[color:var(--line)] p-6">
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
