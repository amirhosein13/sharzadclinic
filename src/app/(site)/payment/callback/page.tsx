import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Copy, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/zarinpal";
import { ButtonLink } from "@/components/ui/button";
import { formatJalaliDateTime } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "نتیجه‌ی پرداخت", robots: { index: false } };

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ Authority?: string; Status?: string }>;
}) {
  const { Authority: authority, Status: status } = await searchParams;

  if (!authority) return <Result ok={false} title="اطلاعات پرداخت ناقص است" />;

  const payment = await prisma.payment.findUnique({
    where: { authority },
    include: { appointment: { include: { service: true } } },
  });

  if (!payment) return <Result ok={false} title="تراکنشی با این مشخصات پیدا نشد" />;

  // اگر قبلاً تأیید شده، دوباره به درگاه درخواست نمی‌دهیم
  if (payment.status === "PAID") {
    return (
      <Result
        ok
        title="این پرداخت قبلاً تأیید شده بود"
        refId={payment.refId}
        amount={payment.amount}
        serviceTitle={payment.appointment?.service.title}
        startsAt={payment.appointment?.startsAt}
      />
    );
  }

  // کاربر در درگاه انصراف داده است
  if (status !== "OK") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return (
      <Result
        ok={false}
        title="پرداخت انجام نشد"
        description="تراکنش لغو شد یا در درگاه ناموفق بود. مبلغی از حساب شما کسر نشده است."
      />
    );
  }

  const verified = await verifyPayment({ authority, amountToman: payment.amount });

  if (!verified.ok) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return <Result ok={false} title="تأیید پرداخت ناموفق بود" description={verified.message} />;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PAID", paidAt: new Date(), refId: verified.refId, reference: verified.refId },
  });

  // پرداخت بیعانه یعنی نوبت قطعی است
  if (payment.appointmentId) {
    await prisma.appointment.updateMany({
      where: { id: payment.appointmentId, status: "PENDING" },
      data: { status: "CONFIRMED" },
    });
  }

  return (
    <Result
      ok
      title="پرداخت با موفقیت انجام شد"
      refId={verified.refId}
      amount={payment.amount}
      serviceTitle={payment.appointment?.service.title}
      startsAt={payment.appointment?.startsAt}
    />
  );
}

function Result({
  ok,
  title,
  description,
  refId,
  amount,
  serviceTitle,
  startsAt,
}: {
  ok: boolean;
  title: string;
  description?: string;
  refId?: string | null;
  amount?: number;
  serviceTitle?: string;
  startsAt?: Date;
}) {
  return (
    <div className="container-page flex min-h-[70vh] items-center py-16">
      <div className="mx-auto w-full max-w-lg rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-10 text-center shadow-lift">
        <div
          className={
            ok
              ? "mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "mx-auto grid size-20 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
          }
        >
          {ok ? <CircleCheck className="size-11" /> : <TriangleAlert className="size-10" />}
        </div>

        <h1 className="mt-7 text-2xl font-extrabold">{title}</h1>
        {description && (
          <p className="mt-4 text-sm leading-8 text-[color:var(--fg-muted)]">{description}</p>
        )}

        {serviceTitle && startsAt && (
          <p className="mt-4 text-sm leading-8 text-[color:var(--fg-muted)]">
            {serviceTitle}
            <br />
            {formatJalaliDateTime(startsAt)}
          </p>
        )}

        {ok && amount !== undefined && (
          <div className="mt-7 rounded-3xl border border-dashed border-emerald-300 bg-emerald-50/50 p-6 dark:border-emerald-400/25 dark:bg-emerald-500/5">
            <p className="text-xs text-[color:var(--fg-muted)]">مبلغ پرداخت‌شده</p>
            <p className="mt-1.5 text-xl font-extrabold">{formatToman(amount)}</p>
            {refId && (
              <>
                <p className="mt-4 text-xs text-[color:var(--fg-muted)]">شماره پیگیری بانکی</p>
                <p className="mt-1 select-all text-lg font-bold tracking-widest" dir="ltr">
                  {toFa(refId)}
                </p>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--fg-muted)]">
                  <Copy className="size-3" />
                  این شماره را نگه دارید
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/account" className="flex-1">
            نوبت‌های من
          </ButtonLink>
          <ButtonLink href="/" variant="outline" className="flex-1">
            صفحه‌ی اصلی
          </ButtonLink>
        </div>

        {!ok && (
          <p className="mt-6 text-xs text-[color:var(--fg-muted)]">
            اگر مبلغی از حساب شما کسر شده،{" "}
            <Link href="/contact" className="text-rose-600 hover:underline dark:text-rose-300">
              با ما تماس بگیرید
            </Link>{" "}
            — طی ۷۲ ساعت به‌صورت خودکار برمی‌گردد.
          </p>
        )}
      </div>
    </div>
  );
}
