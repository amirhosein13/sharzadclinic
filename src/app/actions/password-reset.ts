"use server";

import { z } from "zod";
import {
  NEUTRAL_MESSAGE,
  issueResetCode,
  resetPasswordWithCode,
} from "@/lib/password-reset";
import { notifyPasswordReset } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { fieldErrors } from "@/lib/validators";
import { logAction } from "@/lib/auth";

export type ResetState =
  | { step: "email"; message?: string; errors?: Record<string, string> }
  | {
      step: "code";
      email: string;
      hint: string;
      message?: string;
      errors?: Record<string, string>;
      devCode?: string;
    }
  | { step: "done" };

const emailSchema = z.object({ email: z.string().trim().email("ایمیل معتبر نیست") });

const codeSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, "کد ۶ رقمی است"),
  password: z.string().min(8, "رمز تازه حداقل ۸ کاراکتر باشد"),
});

/** مرحله‌ی اول: گرفتن ایمیل و فرستادن کد به موبایلِ ثبت‌شده‌ی همان کاربر */
export async function requestReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { step: "email", errors: fieldErrors(parsed.error) };

  const email = parsed.data.email;
  const result = await issueResetCode(email);
  if (!result.ok) return { step: "email", message: result.message };

  let simulated = false;
  if (result.code && result.maskedPhone) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user?.phone) {
      const sent = await notifyPasswordReset(user.phone, result.code).catch(() => ({
        ok: false,
        simulated: false,
      }));
      simulated = !!sent.simulated;
    }
  }

  // اگر پیامک واقعاً نرفته باشد، نشان‌دادن کد روی صفحه یعنی هرکسی می‌تواند
  // رمز هر حسابی را عوض کند. به‌جایش راه امنِ ترمینال را نشان می‌دهیم.
  if (simulated && process.env.NODE_ENV === "production") {
    return {
      step: "email",
      message:
        "سرویس پیامک تنظیم نشده و کد ارسال نشد. مدیر می‌تواند با دستور «npm run reset-password» از روی سرور رمز را عوض کند.",
    };
  }

  await logAction({ action: "password.reset.request", entity: "User", detail: email.toLowerCase() });

  return {
    step: "code",
    email,
    hint: result.maskedPhone
      ? `کد به شماره‌ی ${result.maskedPhone} پیامک شد.`
      : NEUTRAL_MESSAGE,
    // فقط در حالت توسعه، تا بدون پنل پیامک هم قابل تست باشد
    devCode: process.env.NODE_ENV !== "production" ? result.code : undefined,
  };
}

/** مرحله‌ی دوم: بررسی کد و نشاندن رمز تازه */
export async function submitReset(prev: ResetState, formData: FormData): Promise<ResetState> {
  const back = (patch: Partial<Extract<ResetState, { step: "code" }>>): ResetState => ({
    step: "code",
    email: String(formData.get("email") ?? ""),
    hint: prev.step === "code" ? prev.hint : "",
    ...patch,
  });

  const parsed = codeSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!parsed.success) return back({ errors: fieldErrors(parsed.error) });

  const result = await resetPasswordWithCode(
    parsed.data.email,
    parsed.data.code,
    parsed.data.password,
  );
  if (!result.ok) return back({ message: result.message });

  await logAction({
    action: "password.reset",
    entity: "User",
    detail: parsed.data.email.toLowerCase(),
  });

  return { step: "done" };
}
