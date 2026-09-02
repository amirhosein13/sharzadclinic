"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import { fieldErrors, publicWaitlistSchema, waitlistSchema } from "@/lib/validators";
import { parseJalaliInput, parseYmdKey } from "@/lib/date";
import { notifyWaitlistOpening } from "@/lib/notifications";
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
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("برای این کار دسترسی ندارید.");
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد. دوباره تلاش کنید.");
  }
}

/** ثبت لیست انتظار از پنل، توسط منشی */
export async function addToWaitlist(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const parsed = waitlistSchema.safeParse({
      customerId: text(formData.get("customerId")),
      serviceId: text(formData.get("serviceId")),
      fromDate: text(formData.get("fromDate")),
      toDate: text(formData.get("toDate")),
      note: text(formData.get("note")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const from = parseJalaliInput(v.fromDate);
    const to = parseJalaliInput(v.toDate);
    if (!from) return FAIL("تاریخ شروع نامعتبر است.", { fromDate: "تاریخ نامعتبر" });
    if (!to) return FAIL("تاریخ پایان نامعتبر است.", { toDate: "تاریخ نامعتبر" });
    if (to < from) return FAIL("تاریخ پایان قبل از شروع است.", { toDate: "قبل از تاریخ شروع" });
    to.setHours(23, 59, 59, 999);

    const entry = await prisma.waitlistEntry.create({
      data: {
        customerId: v.customerId,
        serviceId: v.serviceId,
        fromDate: from,
        toDate: to,
        note: v.note?.trim() || null,
      },
    });

    await logAction({ action: "create", entity: "waitlistEntry", entityId: entry.id });
    revalidatePath("/admin/waitlist");
    revalidatePath(`/admin/customers/${v.customerId}`);
    return OK("به لیست انتظار اضافه شد.");
  }) as Promise<FormResult>;
}

/** خبر دادن به مشتری که وقت خالی شده */
export async function notifyWaitlistEntry(id: string): Promise<FormResult> {
  return guard(async () => {
    const entry = await prisma.waitlistEntry.findUniqueOrThrow({
      where: { id },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        service: { select: { title: true } },
      },
    });

    const result = await notifyWaitlistOpening({
      phone: entry.customer.phone,
      customerName: `${entry.customer.firstName} ${entry.customer.lastName}`,
      serviceTitle: entry.service.title,
    });

    await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "NOTIFIED", notifiedAt: new Date() },
    });
    revalidatePath("/admin/waitlist");

    // حتی اگر پیامک نرفت، وضعیت را ثبت می‌کنیم تا منشی بداند تماس بگیرد
    return result.ok
      ? OK("پیامک «وقت خالی شد» ارسال شد.")
      : OK("وضعیت روی «خبر داده شد» رفت، ولی پیامک ارسال نشد. تلفنی پیگیری کنید.");
  }) as Promise<FormResult>;
}

export async function setWaitlistStatus(
  id: string,
  status: "WAITING" | "BOOKED" | "CANCELLED",
): Promise<FormResult> {
  return guard(async () => {
    await prisma.waitlistEntry.update({ where: { id }, data: { status } });
    revalidatePath("/admin/waitlist");
    const labels = { WAITING: "به انتظار برگشت", BOOKED: "نوبت گرفت", CANCELLED: "منصرف شد" };
    return OK(`ثبت شد: ${labels[status]}.`);
  }) as Promise<FormResult>;
}

export async function deleteWaitlistEntry(id: string): Promise<FormResult> {
  return guard(async () => {
    const removed = await prisma.waitlistEntry.delete({ where: { id } });
    revalidatePath("/admin/waitlist");
    revalidatePath(`/admin/customers/${removed.customerId}`);
    return OK("از لیست انتظار حذف شد.");
  }) as Promise<FormResult>;
}

/**
 * ثبت‌نام لیست انتظار از خود سایت، وقتی مشتری وقت خالی پیدا نمی‌کند.
 * اگر شماره از قبل در سیستم باشد، به همان پرونده وصل می‌شود.
 */
export async function joinWaitlist(formData: FormData): Promise<FormResult> {
  const parsed = publicWaitlistSchema.safeParse({
    serviceId: text(formData.get("serviceId")),
    firstName: text(formData.get("firstName")),
    lastName: text(formData.get("lastName")),
    phone: text(formData.get("phone")),
    fromDate: text(formData.get("fromDate")),
    toDate: text(formData.get("toDate")),
    note: text(formData.get("note")),
  });
  if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

  const v = parsed.data;
  try {
    const from = parseYmdKey(v.fromDate);
    const to = parseYmdKey(v.toDate);
    if (to < from) return FAIL("تاریخ پایان قبل از شروع است.", { toDate: "قبل از تاریخ شروع" });
    to.setHours(23, 59, 59, 999);

    const customer = await prisma.customer.upsert({
      where: { phone: v.phone },
      update: {},
      create: { firstName: v.firstName, lastName: v.lastName, phone: v.phone },
    });

    // درخواست تکراری برای همان خدمت و بازه ثبت نمی‌شود
    const duplicate = await prisma.waitlistEntry.findFirst({
      where: {
        customerId: customer.id,
        serviceId: v.serviceId,
        status: { in: ["WAITING", "NOTIFIED"] },
        fromDate: { lte: to },
        toDate: { gte: from },
      },
    });
    if (duplicate) {
      return OK("شما از قبل در لیست انتظار این خدمت هستید. به‌محض خالی‌شدن وقت خبرتان می‌کنیم.");
    }

    await prisma.waitlistEntry.create({
      data: {
        customerId: customer.id,
        serviceId: v.serviceId,
        fromDate: from,
        toDate: to,
        note: v.note?.trim() || null,
      },
    });

    try {
      revalidatePath("/admin/waitlist");
    } catch {
      // بازتازه‌سازی کش خارج از یک درخواست معنی ندارد و مهم هم نیست
    }
    return OK("در لیست انتظار ثبت شدید. به‌محض خالی‌شدن وقت با شما تماس می‌گیریم.");
  } catch (error) {
    console.error(error);
    return FAIL("ثبت درخواست با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
  }
}
