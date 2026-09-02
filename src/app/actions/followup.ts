"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { generateFollowUps } from "@/lib/followups";
import { parseYmdKey } from "@/lib/date";
import type { FollowUpStatus } from "@prisma/client";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string): FormResult => ({ ok: false, message });

async function guard<T>(fn: () => Promise<T>): Promise<T | FormResult> {
  try {
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("دسترسی لازم برای این کار را ندارید.");
    console.error(error);
    return FAIL("عملیات با خطا مواجه شد.");
  }
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** ثبت نتیجه‌ی تماس و بستن پیگیری */
export async function resolveFollowUp(
  id: string,
  status: FollowUpStatus,
  outcome?: string
): Promise<FormResult> {
  return guard(async () => {
    await prisma.followUp.update({
      where: { id },
      data: {
        status,
        outcome: outcome || null,
        handledAt: status === "OPEN" ? null : new Date(),
      },
    });
    revalidatePath("/admin/followups");
    const labels: Record<string, string> = {
      DONE: "پیگیری انجام‌شده علامت خورد.",
      DISMISSED: "پیگیری بایگانی شد.",
      SNOOZED: "پیگیری به بعد موکول شد.",
      OPEN: "پیگیری دوباره باز شد.",
    };
    return OK(labels[status] ?? "به‌روزرسانی شد.");
  }) as Promise<FormResult>;
}

/** به تعویق انداختن پیگیری به تاریخ مشخص */
export async function snoozeFollowUp(id: string, days: number): Promise<FormResult> {
  return guard(async () => {
    const due = new Date();
    due.setDate(due.getDate() + Math.max(1, Math.min(90, days)));
    await prisma.followUp.update({
      where: { id },
      data: { dueAt: due, status: "OPEN", note: null },
    });
    revalidatePath("/admin/followups");
    return OK(`پیگیری به ${days} روز دیگر موکول شد.`);
  }) as Promise<FormResult>;
}

/** یادآوری دستی که منشی خودش ثبت می‌کند */
export async function createManualFollowUp(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const customerId = text(formData.get("customerId"));
    const dueDate = text(formData.get("dueDate"));
    const reason = text(formData.get("reason"));

    if (!customerId) return FAIL("مشتری مشخص نشده است.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return FAIL("تاریخ پیگیری را انتخاب کنید.");
    if (reason.length < 3) return FAIL("علت پیگیری را بنویسید.");

    await prisma.followUp.create({
      data: {
        customerId,
        kind: "CUSTOM",
        dueAt: parseYmdKey(dueDate),
        reason,
        note: text(formData.get("note")) || null,
      },
    });

    revalidatePath("/admin/followups");
    revalidatePath(`/admin/customers/${customerId}`);
    return OK("یادآوری ثبت شد.");
  }) as Promise<FormResult>;
}

/** ساخت پیگیری‌های خودکار — دکمه‌ی «به‌روزرسانی فهرست» */
export async function refreshFollowUps(): Promise<FormResult> {
  return guard(async () => {
    const result = await generateFollowUps();
    revalidatePath("/admin/followups");
    const total = result.noShow + result.nextSession;
    return OK(
      total === 0
        ? "فهرست به‌روز است، مورد جدیدی پیدا نشد."
        : `${total} پیگیری جدید اضافه شد.`
    );
  }) as Promise<FormResult>;
}
