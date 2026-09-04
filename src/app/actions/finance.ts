"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import {
  expenseSchema, fieldErrors, inventoryItemSchema, serviceMaterialSchema, stockMovementSchema,
} from "@/lib/validators";
import { recordMovement } from "@/lib/inventory";
import { parseJalaliInput } from "@/lib/date";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** هزینه و انبار داده‌ی مالی است — منشی و اپراتور دسترسی ندارند */
async function guard<T>(fn: () => Promise<T>) {
  try {
    await requireRole("ADMIN", "MANAGER");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("فقط مدیر به بخش مالی و انبار دسترسی دارد.");
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد. دوباره تلاش کنید.");
  }
}

/* ── هزینه‌ها ────────────────────────────────────────────────── */

export async function saveExpense(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const id = text(formData.get("id"));
    const parsed = expenseSchema.safeParse({
      categoryId: text(formData.get("categoryId")),
      staffId: text(formData.get("staffId")),
      title: text(formData.get("title")),
      amount: text(formData.get("amount")),
      spentAt: text(formData.get("spentAt")),
      note: text(formData.get("note")),
      paidFromCash: formData.get("paidFromCash") === "on",
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const spentAt = parseJalaliInput(v.spentAt);
    if (!spentAt) return FAIL("تاریخ نامعتبر است.", { spentAt: "تاریخ نامعتبر" });

    if (id) {
      const existing = await prisma.expense.findUnique({ where: { id }, select: { stockMovementId: true } });
      if (existing?.stockMovementId) {
        return FAIL("این هزینه از خرید انبار آمده و از همان‌جا باید اصلاح شود.");
      }
    }

    const data = {
      categoryId: v.categoryId,
      staffId: v.staffId?.trim() || null,
      title: v.title,
      amount: v.amount,
      spentAt,
      note: v.note?.trim() || null,
      paidFromCash: !!v.paidFromCash,
    };

    const saved = id
      ? await prisma.expense.update({ where: { id }, data })
      : await prisma.expense.create({ data });

    await logAction({ action: id ? "update" : "create", entity: "Expense", entityId: saved.id });
    revalidatePath("/admin/expenses");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/cash");
    return OK(id ? "هزینه به‌روزرسانی شد." : "هزینه ثبت شد.");
  }) as Promise<FormResult>;
}

export async function deleteExpense(id: string): Promise<FormResult> {
  return guard(async () => {
    const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
    if (expense.stockMovementId) {
      return FAIL("این هزینه از خرید انبار آمده و جداگانه حذف نمی‌شود.");
    }
    await prisma.expense.delete({ where: { id } });
    await logAction({ action: "delete", entity: "Expense", entityId: id });
    revalidatePath("/admin/expenses");
    revalidatePath("/admin/reports");
    return OK("هزینه حذف شد.");
  }) as Promise<FormResult>;
}

/* ── انبار ──────────────────────────────────────────────────── */

export async function saveInventoryItem(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const id = text(formData.get("id"));
    const parsed = inventoryItemSchema.safeParse({
      name: text(formData.get("name")),
      unit: text(formData.get("unit")),
      minStock: text(formData.get("minStock")),
      unitCost: text(formData.get("unitCost")),
      supplier: text(formData.get("supplier")),
      note: text(formData.get("note")),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const data = {
      name: v.name,
      unit: v.unit,
      minStock: v.minStock ?? 0,
      unitCost: v.unitCost ?? 0,
      supplier: v.supplier?.trim() || null,
      note: v.note?.trim() || null,
      isActive: v.isActive ?? false,
    };

    const saved = id
      ? await prisma.inventoryItem.update({ where: { id }, data })
      : await prisma.inventoryItem.create({ data });

    await logAction({ action: id ? "update" : "create", entity: "InventoryItem", entityId: saved.id });
    revalidatePath("/admin/inventory");
    return OK(id ? "قلم انبار به‌روزرسانی شد." : `«${saved.name}» به انبار اضافه شد.`);
  }) as Promise<FormResult>;
}

export async function deleteInventoryItem(id: string): Promise<FormResult> {
  return guard(async () => {
    const used = await prisma.stockMovement.count({ where: { itemId: id } });
    if (used > 0) {
      return FAIL("این قلم سابقه‌ی ورود و خروج دارد و حذفش تاریخچه را از بین می‌برد. غیرفعالش کنید.");
    }
    await prisma.inventoryItem.delete({ where: { id } });
    revalidatePath("/admin/inventory");
    return OK("قلم انبار حذف شد.");
  }) as Promise<FormResult>;
}

export async function saveStockMovement(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const parsed = stockMovementSchema.safeParse({
      itemId: text(formData.get("itemId")),
      kind: text(formData.get("kind")) || "IN",
      quantity: text(formData.get("quantity")),
      unitCost: text(formData.get("unitCost")),
      note: text(formData.get("note")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    await recordMovement({
      itemId: v.itemId,
      kind: v.kind,
      quantity: v.quantity,
      unitCost: v.unitCost ?? undefined,
      note: v.note?.trim() || null,
      // در اصلاح شمارش، عددِ واردشده موجودیِ نهایی است نه تفاضل
      absoluteStock: v.kind === "ADJUST" ? v.quantity : undefined,
    });

    await logAction({ action: `stock.${v.kind.toLowerCase()}`, entity: "InventoryItem", entityId: v.itemId });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/expenses");
    revalidatePath("/admin/reports");

    const labels = { IN: "خرید ثبت شد", OUT: "مصرف ثبت شد", ADJUST: "موجودی اصلاح شد", WASTE: "ضایعات ثبت شد" };
    return OK(labels[v.kind]);
  }) as Promise<FormResult>;
}

/* ── مواد هر خدمت ───────────────────────────────────────────── */

export async function saveServiceMaterial(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const parsed = serviceMaterialSchema.safeParse({
      serviceId: text(formData.get("serviceId")),
      itemId: text(formData.get("itemId")),
      quantity: text(formData.get("quantity")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    await prisma.serviceMaterial.upsert({
      where: { serviceId_itemId: { serviceId: v.serviceId, itemId: v.itemId } },
      update: { quantity: v.quantity },
      create: v,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/reports");
    return OK("ماده‌ی مصرفی خدمت ثبت شد.");
  }) as Promise<FormResult>;
}

export async function deleteServiceMaterial(id: string): Promise<FormResult> {
  return guard(async () => {
    await prisma.serviceMaterial.delete({ where: { id } });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/reports");
    return OK("ماده از فهرست خدمت حذف شد.");
  }) as Promise<FormResult>;
}
