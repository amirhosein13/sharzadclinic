"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";
import { getSettings } from "@/lib/settings";
import { isZarinpalConfigured, requestPayment } from "@/lib/zarinpal";

export type PayResult = { ok: false; message: string };

/**
 * شروع پرداخت بیعانه‌ی یک نوبت.
 * یک رکورد پرداخت با وضعیت PENDING ساخته و کاربر به درگاه هدایت می‌شود.
 */
export async function startDepositPayment(formData: FormData): Promise<PayResult> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!appointmentId) return { ok: false, message: "نوبت مشخص نشده است." };

  if (!isZarinpalConfigured()) {
    return { ok: false, message: "درگاه پرداخت هنوز توسط کلینیک تنظیم نشده است." };
  }

  const session = await getCustomerSession();
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { customer: true, service: true },
  });

  if (!appointment) return { ok: false, message: "این نوبت پیدا نشد." };

  // فقط صاحب نوبت می‌تواند برایش پرداخت کند
  if (!session || session.id !== appointment.customerId) {
    return { ok: false, message: "برای پرداخت باید با شماره‌ی همین نوبت وارد شوید." };
  }
  if (appointment.status === "CANCELLED" || appointment.status === "DONE") {
    return { ok: false, message: "برای این نوبت امکان پرداخت وجود ندارد." };
  }

  const settings = await getSettings();
  const depositPercent = Math.min(100, Math.max(0, Number(settings.depositPercent) || 30));
  const price = appointment.service.priceFrom ?? 0;
  const amount = Math.round((price * depositPercent) / 100);

  if (amount < 1000) {
    return { ok: false, message: "برای این خدمت مبلغ بیعانه تعریف نشده است." };
  }

  const alreadyPaid = await prisma.payment.findFirst({
    where: { appointmentId, status: "PAID" },
  });
  if (alreadyPaid) return { ok: false, message: "برای این نوبت قبلاً پرداخت ثبت شده است." };

  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const result = await requestPayment({
    amountToman: amount,
    description: `بیعانه‌ی ${appointment.service.title} — ${settings.clinicName}`,
    callbackUrl: `${base}/payment/callback`,
    mobile: appointment.customer.phone,
    email: appointment.customer.email ?? undefined,
  });

  if (!result.ok) return { ok: false, message: result.message };

  await prisma.payment.create({
    data: {
      customerId: appointment.customerId,
      appointmentId,
      amount,
      method: "ONLINE",
      status: "PENDING",
      gateway: "zarinpal",
      authority: result.authority,
      note: `بیعانه ${depositPercent}٪`,
    },
  });

  redirect(result.redirectUrl);
}
