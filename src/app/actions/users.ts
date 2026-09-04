"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, logAction, requireRole } from "@/lib/auth";
import { fieldErrors, userSchema } from "@/lib/validators";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

async function guardUsers<T>(fn: () => Promise<T>): Promise<T | FormResult> {
  try {
    await requireRole("ADMIN");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("فقط مدیر کل می‌تواند کاربران را مدیریت کند.");
    if (message.includes("Unique constraint")) {
      return FAIL("این ایمیل یا این پرسنل قبلاً به حسابی متصل شده است.");
    }
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد.");
  }
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function saveUser(formData: FormData): Promise<FormResult> {
  return guardUsers(async () => {
    const id = text(formData.get("id"));
    const parsed = userSchema.safeParse({
      name: text(formData.get("name")),
      email: text(formData.get("email")),
      phone: text(formData.get("phone")),
      role: text(formData.get("role")),
      staffId: text(formData.get("staffId")),
      password: text(formData.get("password")),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    if (!id && !v.password) return FAIL("برای کاربر جدید باید رمز عبور تعیین کنید.", { password: "رمز عبور الزامی است" });

    const data = {
      name: v.name,
      email: v.email,
      phone: v.phone || null,
      role: v.role,
      staffId: v.role === "OPERATOR" ? (v.staffId || null) : null,
      isActive: !!v.isActive,
      ...(v.password ? { passwordHash: await hashPassword(v.password) } : {}),
    };

    if (id) {
      // مدیر کل نباید بتواند دسترسی خودش را قطع کند
      const target = await prisma.user.findUniqueOrThrow({ where: { id } });
      if (target.role === "ADMIN" && (v.role !== "ADMIN" || !v.isActive)) {
        const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
        if (admins <= 1) {
          return FAIL("این تنها مدیر کل فعال سیستم است و نمی‌تواند غیرفعال یا کم‌دسترسی شود.");
        }
      }
      await prisma.user.update({ where: { id }, data });
    } else {
      await prisma.user.create({ data: { ...data, passwordHash: data.passwordHash! } });
    }

    await logAction({ action: id ? "user.update" : "user.create", entity: "User", entityId: id || null });
    revalidatePath("/admin/users");
    return OK(id ? "کاربر به‌روزرسانی شد." : "کاربر جدید ساخته شد.");
  }) as Promise<FormResult>;
}

export async function deleteUser(id: string): Promise<FormResult> {
  return guardUsers(async () => {
    const target = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (target.role === "ADMIN") {
      const admins = await prisma.user.count({ where: { role: "ADMIN" } });
      if (admins <= 1) return FAIL("آخرین مدیر کل سیستم قابل حذف نیست.");
    }
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/users");
    return OK("کاربر حذف شد.");
  }) as Promise<FormResult>;
}
