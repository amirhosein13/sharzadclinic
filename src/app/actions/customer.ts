"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createCustomerSession, destroyCustomerSession, getCustomerSession, issueOtp, verifyOtp,
} from "@/lib/customer-auth";
import { notifyBookingCancelled, notifyOtp } from "@/lib/notifications";
import { isValidIranMobile, normalizePhone, toEn } from "@/lib/utils";

export type OtpState =
  | { step: "phone"; message?: string }
  | { step: "code"; phone: string; message?: string; devCode?: string };

/** مرحله‌ی اول: دریافت شماره و ارسال کد */
export async function requestOtp(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const raw = String(formData.get("phone") ?? "");
  if (!isValidIranMobile(raw)) {
    return { step: "phone", message: "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)" };
  }

  const phone = normalizePhone(raw);

  // وجود مشتری را افشا نمی‌کنیم؛ پیام یکسان است تا شماره‌ها قابل شمارش نباشند
  const result = await issueOtp(phone);
  if (!result.ok) return { step: "phone", message: result.message };

  const exists = await prisma.customer.findUnique({ where: { phone }, select: { id: true } });

  let simulated = false;
  if (exists && result.code) {
    const sent = await notifyOtp(phone, result.code).catch(() => ({ ok: false, simulated: false }));
    simulated = !!sent.simulated;
  }

  // در پروداکشن اگر پیامک واقعاً ارسال نشود، کد را روی صفحه نشان نمی‌دهیم —
  // این یعنی هر کسی می‌توانست با هر شماره‌ای وارد شود. به‌جایش صریح خطا می‌دهیم.
  if (simulated && process.env.NODE_ENV === "production") {
    return {
      step: "phone",
      message:
        "سرویس پیامک هنوز تنظیم نشده و کد ورود ارسال نشد. لطفاً با کلینیک تماس بگیرید.",
    };
  }

  return {
    step: "code",
    phone,
    // فقط در حالت توسعه، تا بدون پنل پیامک هم قابل تست باشد
    devCode: process.env.NODE_ENV !== "production" ? result.code : undefined,
  };
}

/** مرحله‌ی دوم: بررسی کد و ساخت نشست */
export async function confirmOtp(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const phone = String(formData.get("phone") ?? "");
  const code = toEn(String(formData.get("code") ?? "")).trim();

  if (!/^\d{6}$/.test(code)) {
    return { step: "code", phone, message: "کد باید ۶ رقم باشد." };
  }

  const result = await verifyOtp(phone, code);
  if (!result.ok) return { step: "code", phone, message: result.message };

  await createCustomerSession(result.customer);
  redirect("/account");
}

export async function customerLogout() {
  await destroyCustomerSession();
  redirect("/");
}

export type CustomerActionResult = { ok: boolean; message: string };

/** لغو نوبت توسط خود مشتری */
export async function cancelMyAppointment(id: string): Promise<CustomerActionResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, message: "برای این کار باید وارد حساب شوید." };

  const appointment = await prisma.appointment.findFirst({
    where: { id, customerId: session.id },
    include: { customer: true },
  });
  if (!appointment) return { ok: false, message: "این نوبت پیدا نشد." };

  if (appointment.status === "CANCELLED") {
    return { ok: false, message: "این نوبت قبلاً لغو شده است." };
  }
  if (appointment.status === "DONE") {
    return { ok: false, message: "نوبت انجام‌شده قابل لغو نیست." };
  }

  // قانون کلینیک: لغو تا ۶ ساعت قبل
  const hoursLeft = (appointment.startsAt.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < 6) {
    return {
      ok: false,
      message: "لغو آنلاین تا ۶ ساعت قبل از نوبت ممکن است. لطفاً تلفنی هماهنگ کنید.",
    };
  }

  await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });

  await notifyBookingCancelled({
    phone: appointment.customer.phone,
    customerName: `${appointment.customer.firstName} ${appointment.customer.lastName}`,
    startsAt: appointment.startsAt,
  }).catch(() => undefined);

  revalidatePath("/account");
  revalidatePath("/admin/appointments");
  return { ok: true, message: "نوبت شما لغو شد." };
}

/** ویرایش اطلاعات شخصی توسط مشتری */
export async function updateMyProfile(formData: FormData): Promise<CustomerActionResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, message: "برای این کار باید وارد حساب شوید." };

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (firstName.length < 2 || lastName.length < 2) {
    return { ok: false, message: "نام و نام خانوادگی را کامل وارد کنید." };
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: "ایمیل معتبر نیست." };
  }

  await prisma.customer.update({
    where: { id: session.id },
    data: { firstName, lastName, email: email || null },
  });

  // نام داخل نشست هم به‌روز شود
  await createCustomerSession({ ...session, name: `${firstName} ${lastName}` });

  revalidatePath("/account");
  return { ok: true, message: "اطلاعات شما ذخیره شد." };
}
