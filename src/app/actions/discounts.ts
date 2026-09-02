"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import { discountSchema, fieldErrors } from "@/lib/validators";
import { checkDiscount } from "@/lib/discounts";
import { parseJalaliInput } from "@/lib/date";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function guard<T>(fn: () => Promise<T>) {
  try {
    await requireRole("ADMIN", "MANAGER");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("فقط مدیر می‌تواند کد تخفیف بسازد.");
    if (message.includes("Unique constraint")) return FAIL("کدی با همین نام از قبل وجود دارد.");
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد. دوباره تلاش کنید.");
  }
}

export async function saveDiscount(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const id = text(formData.get("id"));
    const parsed = discountSchema.safeParse({
      code: text(formData.get("code")),
      kind: text(formData.get("kind")) || "PERCENT",
      value: text(formData.get("value")),
      minAmount: text(formData.get("minAmount")),
      maxDiscount: text(formData.get("maxDiscount")),
      maxUses: text(formData.get("maxUses")),
      startsAt: text(formData.get("startsAt")),
      expiresAt: text(formData.get("expiresAt")),
      isActive: formData.get("isActive") === "on",
      note: text(formData.get("note")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    if (v.kind === "PERCENT" && (v.value < 1 || v.value > 100)) {
      return FAIL("درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.", { value: "بین ۱ تا ۱۰۰" });
    }

    const startsAt = v.startsAt ? parseJalaliInput(v.startsAt) : null;
    const expiresAt = v.expiresAt ? parseJalaliInput(v.expiresAt) : null;
    if (v.startsAt && !startsAt) return FAIL("تاریخ شروع نامعتبر است.", { startsAt: "تاریخ نامعتبر" });
    if (v.expiresAt && !expiresAt) return FAIL("تاریخ پایان نامعتبر است.", { expiresAt: "تاریخ نامعتبر" });
    if (startsAt && expiresAt && startsAt > expiresAt) {
      return FAIL("تاریخ پایان نمی‌تواند قبل از شروع باشد.", { expiresAt: "قبل از تاریخ شروع است" });
    }
    // تا پایان همان روز معتبر بماند
    if (expiresAt) expiresAt.setHours(23, 59, 59, 999);

    const data = {
      code: v.code,
      kind: v.kind,
      value: v.value,
      minAmount: v.minAmount,
      maxDiscount: v.kind === "PERCENT" ? v.maxDiscount : null,
      maxUses: v.maxUses,
      startsAt,
      expiresAt,
      isActive: v.isActive ?? false,
      note: v.note?.trim() || null,
    };

    const saved = id
      ? await prisma.discountCode.update({ where: { id }, data })
      : await prisma.discountCode.create({ data });

    await logAction({ action: id ? "update" : "create", entity: "discountCode", entityId: saved.id });
    revalidatePath("/admin/discounts");
    return OK(id ? "کد تخفیف به‌روزرسانی شد." : `کد ${saved.code} ساخته شد.`);
  }) as Promise<FormResult>;
}

export async function toggleDiscount(id: string): Promise<FormResult> {
  return guard(async () => {
    const current = await prisma.discountCode.findUniqueOrThrow({ where: { id } });
    await prisma.discountCode.update({ where: { id }, data: { isActive: !current.isActive } });
    revalidatePath("/admin/discounts");
    return OK(current.isActive ? "کد غیرفعال شد." : "کد فعال شد.");
  }) as Promise<FormResult>;
}

export async function deleteDiscount(id: string): Promise<FormResult> {
  return guard(async () => {
    const used = await prisma.discountUse.count({ where: { codeId: id } });
    if (used > 0) {
      return FAIL("این کد استفاده شده و حذفش سابقه‌ی تخفیف‌ها را از بین می‌برد. غیرفعالش کنید.");
    }
    await prisma.discountCode.delete({ where: { id } });
    await logAction({ action: "delete", entity: "discountCode", entityId: id });
    revalidatePath("/admin/discounts");
    return OK("کد تخفیف حذف شد.");
  }) as Promise<FormResult>;
}

/** بررسی کد از فرم رزرو — فقط نتیجه را برمی‌گرداند و چیزی ثبت نمی‌کند */
export async function previewDiscount(
  code: string,
  amount: number,
): Promise<{ ok: true; discount: number; finalAmount: number; label: string } | { ok: false; message: string }> {
  const result = await checkDiscount({ code, amount });
  if (!result.ok) return result;
  return {
    ok: true,
    discount: result.discount,
    finalAmount: result.finalAmount,
    label: result.label,
  };
}
