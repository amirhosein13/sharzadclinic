"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, logAction } from "@/lib/auth";
import { fieldErrors, loginSchema } from "@/lib/validators";
import { homeFor } from "@/lib/guard";

export type LoginState = { message?: string; errors?: Record<string, string> };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return { message: "ایمیل یا رمز عبور اشتباه است." };

  await createSession(user);
  await logAction({ userId: user.id, action: "login", entity: "User", entityId: user.id });

  // هر نقش به صفحه‌ی خانه‌ی خودش می‌رود
  const home = homeFor(user);
  const next = String(formData.get("next") || home);
  redirect(next.startsWith("/admin") ? next : home);
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
