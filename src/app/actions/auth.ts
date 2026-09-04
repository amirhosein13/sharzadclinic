"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, logAction } from "@/lib/auth";
import { fieldErrors, loginSchema } from "@/lib/validators";
import { checkLoginAllowed, recordFailedLogin } from "@/lib/login-guard";
import { homeFor } from "@/lib/guard";

export type LoginState = { message?: string; errors?: Record<string, string> };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // جلوی امتحان‌کردن بی‌نهایت رمز را می‌گیرد
  const gate = await checkLoginAllowed(parsed.data.email);
  if (!gate.allowed) return { message: gate.message };

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    await recordFailedLogin(parsed.data.email);
    const after = await checkLoginAllowed(parsed.data.email);
    return {
      message: after.allowed
        ? "ایمیل یا رمز عبور اشتباه است."
        : after.message,
    };
  }

  await createSession(user);
  await logAction({
    userId: user.id,
    action: "login",
    entity: "User",
    entityId: user.id,
    // ایمیل مبنای شمارش تلاش‌های ناموفق است
    detail: user.email.toLowerCase(),
  });

  // هر نقش به صفحه‌ی خانه‌ی خودش می‌رود
  const home = homeFor(user);
  const next = String(formData.get("next") || home);
  redirect(next.startsWith("/admin") ? next : home);
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
