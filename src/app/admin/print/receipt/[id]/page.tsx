import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/admin/print-button";
import { formatJalaliLong, formatJalaliDateTime } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const METHOD_LABELS: Record<string, string> = {
  CASH: "نقدی",
  CARD: "کارت‌خوان",
  ONLINE: "آنلاین",
  OTHER: "سایر",
};

/** رسید پرداخت برای مشتری — قابل چاپ یا ذخیره به PDF از خود مرورگر */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await guardPage("payroll");
  const { id } = await params;

  const [payment, settings] = await Promise.all([
    prisma.payment.findUnique({
      where: { id },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        appointment: {
          include: { service: { select: { title: true } }, staff: { select: { name: true } } },
        },
      },
    }),
    getSettings(),
  ]);
  if (!payment || payment.status !== "PAID") notFound();

  const rows: [string, string][] = [
    ["شماره رسید", toFa(payment.id.slice(-8).toUpperCase())],
    ["تاریخ", payment.paidAt ? formatJalaliDateTime(payment.paidAt) : "—"],
    ["نام مراجعه‌کننده", `${payment.customer.firstName} ${payment.customer.lastName}`],
    ["شماره تماس", toFa(payment.customer.phone)],
  ];
  if (payment.appointment) {
    rows.push(["خدمت", payment.appointment.service.title]);
    if (payment.appointment.staff) rows.push(["انجام‌دهنده", payment.appointment.staff.name]);
    rows.push(["تاریخ مراجعه", formatJalaliLong(payment.appointment.startsAt)]);
    rows.push(["کد نوبت", toFa(payment.appointment.code)]);
  }
  rows.push(["روش پرداخت", METHOD_LABELS[payment.method] ?? payment.method]);
  if (payment.reference) rows.push(["شماره پیگیری", toFa(payment.reference)]);

  return (
    <main className="mx-auto max-w-lg bg-white p-8 text-[color:#1c1418] print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton label="چاپ رسید" />
      </div>

      <header className="border-b-2 border-neutral-800 pb-4 text-center">
        <h1 className="text-lg font-extrabold">{settings.clinicName}</h1>
        {settings.address && <p className="mt-1 text-xs text-neutral-600">{settings.address}</p>}
        {settings.phone && (
          <p className="mt-0.5 text-xs text-neutral-600" dir="ltr">
            {toFa(settings.phone)}
          </p>
        )}
        <h2 className="mt-4 text-base font-bold">رسید پرداخت</h2>
      </header>

      <table className="mt-6 w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-neutral-200">
              <th className="py-2.5 text-right font-normal text-neutral-600">{label}</th>
              <td className="py-2.5 text-left font-medium">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex items-center justify-between border-y-2 border-neutral-800 py-4">
        <span className="font-bold">مبلغ دریافتی</span>
        <span className="text-lg font-extrabold">{formatToman(payment.amount)}</span>
      </div>

      {payment.note && (
        <p className="mt-4 text-xs leading-7 text-neutral-600">{payment.note}</p>
      )}

      <footer className="mt-10 text-center text-xs leading-7 text-neutral-500">
        از اعتماد شما سپاسگزاریم.
        <br />
        این رسید بابت مبلغ دریافتی است و جای صورتحساب رسمی مالیاتی را نمی‌گیرد.
      </footer>
    </main>
  );
}
