import { CreditCard, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { isZarinpalConfigured } from "@/lib/zarinpal";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { deletePayment } from "@/app/actions/payroll";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong, timeAgoFa } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  CASH: "نقدی",
  CARD: "کارت‌خوان",
  ONLINE: "آنلاین",
  OTHER: "سایر",
};

const STATUS_META: Record<string, { label: string; tone: "green" | "amber" | "red" | "neutral" }> = {
  PAID: { label: "پرداخت شد", tone: "green" },
  PENDING: { label: "در انتظار", tone: "amber" },
  FAILED: { label: "ناموفق", tone: "red" },
  REFUNDED: { label: "مسترد شد", tone: "neutral" },
};

export default async function PaymentsPage() {
  await guardPage("payroll");

  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 29);
  monthStart.setHours(0, 0, 0, 0);

  const [payments, monthTotal] = await Promise.all([
    prisma.payment.findMany({
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        appointment: { select: { code: true, service: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", paidAt: { gte: monthStart } },
    }),
  ]);

  const online = payments.filter((p) => p.gateway === "zarinpal").length;

  return (
    <>
      <AdminPageHeader
        title="پرداخت‌ها"
        description="صد تراکنش اخیر — نقدی، کارت‌خوان و آنلاین."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">درآمد ۳۰ روز اخیر</p>
          <p className="mt-2 text-lg font-extrabold text-rose-600 dark:text-rose-300">
            {formatToman(monthTotal._sum.amount ?? 0)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">تراکنش‌های ثبت‌شده</p>
          <p className="mt-2 text-lg font-extrabold">{toFa(payments.length)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[color:var(--fg-muted)]">پرداخت آنلاین</p>
          <p className="mt-2 text-lg font-extrabold">{toFa(online)}</p>
        </Card>
      </div>

      {!isZarinpalConfigured() && (
        <Card className="mb-6 border-amber-300/60 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-500/5">
          <p className="flex items-start gap-3 text-sm leading-7">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <span>
              درگاه زرین‌پال تنظیم نشده و دکمه‌ی پرداخت آنلاین به مشتریان نمایش داده نمی‌شود.
              شناسه‌ی پذیرنده را در{" "}
              <code className="rounded bg-[color:var(--bg-sunken)] px-1.5 py-0.5 text-xs">ZARINPAL_MERCHANT_ID</code>{" "}
              وارد کنید. با{" "}
              <code className="rounded bg-[color:var(--bg-sunken)] px-1.5 py-0.5 text-xs">ZARINPAL_SANDBOX=true</code>{" "}
              می‌توانید بدون پول واقعی تست کنید.
            </span>
          </p>
        </Card>
      )}

      {payments.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="تراکنشی ثبت نشده"
          description="پرداخت هر نوبت را از صفحه‌ی نوبت‌ها ثبت کنید تا محاسبه‌ی پورسانت دقیق شود."
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-right font-medium">مشتری</th>
                  <th className="px-5 py-3 text-right font-medium">بابت</th>
                  <th className="px-5 py-3 text-right font-medium">مبلغ</th>
                  <th className="px-5 py-3 text-right font-medium">روش</th>
                  <th className="px-5 py-3 text-right font-medium">وضعیت</th>
                  <th className="px-5 py-3 text-right font-medium">زمان</th>
                  <th className="px-5 py-3 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {payments.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-[color:var(--bg-sunken)]">
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {p.customer.firstName} {p.customer.lastName}
                      </p>
                      <p className="text-xs text-[color:var(--fg-muted)]" dir="ltr">
                        {toFa(p.customer.phone)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {p.appointment?.service.title ?? "—"}
                      {p.appointment && (
                        <span className="block text-[color:var(--fg-muted)]">{p.appointment.code}</span>
                      )}
                      {p.note && <span className="block text-[color:var(--fg-muted)]">{p.note}</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium">{formatToman(p.amount)}</td>
                    <td className="px-5 py-4 text-xs">
                      {METHOD_LABELS[p.method] ?? p.method}
                      {p.gateway === "zarinpal" && (
                        <span className="mt-1 flex items-center gap-1 text-[color:var(--fg-muted)]">
                          <CreditCard className="size-3" />
                          زرین‌پال
                        </span>
                      )}
                      {p.refId && (
                        <span className="block text-[10px] text-[color:var(--fg-muted)]" dir="ltr">
                          {toFa(p.refId)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={STATUS_META[p.status]?.tone ?? "neutral"}>
                        {STATUS_META[p.status]?.label ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-[color:var(--fg-muted)]">
                      {p.paidAt ? formatJalaliLong(p.paidAt) : timeAgoFa(p.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <ActionButton
                        action={deletePayment.bind(null, p.id)}
                        confirm={`این پرداخت ${formatToman(p.amount)} حذف شود؟`}
                        title="حذف پرداخت"
                        className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
