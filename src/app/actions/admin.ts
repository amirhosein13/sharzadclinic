"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { setSettings } from "@/lib/settings";
import { testimonialSchema } from "@/lib/validators";
import { notifyBookingCancelled, notifyBookingConfirmed } from "@/lib/notifications";
import type { AppointmentStatus } from "@prisma/client";

export type ActionResult = { ok: boolean; message: string };

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

/** پوششی که خطاهای پیش‌بینی‌نشده را به پیام فارسی تبدیل می‌کند */
async function guarded(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("دسترسی لازم برای این کار را ندارید.");
    return FAIL("عملیات با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
  }
}

// ─── نوبت‌ها ───────────────────────────────────────────────────

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireUser();

    // اپراتور فقط نوبت‌های خودش را می‌تواند تغییر دهد
    if (!can(user.role, "appointments.write")) {
      if (!can(user.role, "appointments.own")) return FAIL("دسترسی لازم برای این کار را ندارید.");
      const owns = await prisma.appointment.findFirst({
        where: { id, staffId: user.staffId ?? "__none__" },
        select: { id: true },
      });
      if (!owns) return FAIL("این نوبت به شما اختصاص داده نشده است.");
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: { customer: true, service: true },
    });

    // مشتری را از تأیید یا لغو باخبر می‌کنیم
    const customerName = `${appointment.customer.firstName} ${appointment.customer.lastName}`;
    if (status === "CONFIRMED") {
      await notifyBookingConfirmed({
        phone: appointment.customer.phone,
        customerName,
        serviceTitle: appointment.service.title,
        startsAt: appointment.startsAt,
      }).catch(() => undefined);
    } else if (status === "CANCELLED") {
      await notifyBookingCancelled({
        phone: appointment.customer.phone,
        customerName,
        startsAt: appointment.startsAt,
      }).catch(() => undefined);
    }

    await logAction({
      userId: user.id,
      action: "appointment.status",
      entity: "Appointment",
      entityId: id,
      detail: status,
    });
    revalidatePath("/admin/appointments");
    revalidatePath("/admin");
    return OK(`وضعیت نوبت ${appointment.code} تغییر کرد.`);
  });
}

export async function updateAppointmentNote(id: string, adminNote: string): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireRole("ADMIN", "MANAGER", "RECEPTION");
    await prisma.appointment.update({ where: { id }, data: { adminNote: adminNote || null } });
    await logAction({ userId: user.id, action: "appointment.note", entity: "Appointment", entityId: id });
    revalidatePath("/admin/appointments");
    return OK("یادداشت ذخیره شد.");
  });
}

export async function deleteAppointment(id: string): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireRole("ADMIN", "MANAGER");
    await prisma.appointment.delete({ where: { id } });
    await logAction({ userId: user.id, action: "appointment.delete", entity: "Appointment", entityId: id });
    revalidatePath("/admin/appointments");
    return OK("نوبت حذف شد.");
  });
}

// ─── مشتریان ───────────────────────────────────────────────────

export async function updateCustomerNotes(id: string, notes: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
    await prisma.customer.update({ where: { id }, data: { notes: notes || null } });
    revalidatePath(`/admin/customers/${id}`);
    return OK("یادداشت مشتری ذخیره شد.");
  });
}

export async function toggleCustomerBlock(id: string): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireRole("ADMIN", "MANAGER", "RECEPTION");
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });
    await prisma.customer.update({ where: { id }, data: { isBlocked: !customer.isBlocked } });
    await logAction({ userId: user.id, action: "customer.block", entity: "Customer", entityId: id });
    revalidatePath("/admin/customers");
    return OK(customer.isBlocked ? "محدودیت مشتری برداشته شد." : "مشتری محدود شد.");
  });
}

// ─── نظرات ─────────────────────────────────────────────────────

export async function toggleTestimonial(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    const item = await prisma.testimonial.findUniqueOrThrow({ where: { id } });
    await prisma.testimonial.update({ where: { id }, data: { isApproved: !item.isApproved } });
    revalidatePath("/admin/testimonials");
    revalidatePath("/");
    return OK(item.isApproved ? "نظر از سایت برداشته شد." : "نظر روی سایت منتشر شد.");
  });
}

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    await prisma.testimonial.delete({ where: { id } });
    revalidatePath("/admin/testimonials");
    revalidatePath("/");
    return OK("نظر حذف شد.");
  });
}

export async function createTestimonial(formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    const parsed = testimonialSchema.safeParse({
      authorName: formData.get("authorName"),
      serviceName: formData.get("serviceName") ?? "",
      rating: formData.get("rating"),
      body: formData.get("body"),
    });
    if (!parsed.success) return FAIL(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.");

    await prisma.testimonial.create({
      data: { ...parsed.data, serviceName: parsed.data.serviceName || null, isApproved: true },
    });
    revalidatePath("/admin/testimonials");
    revalidatePath("/");
    return OK("نظر جدید ثبت شد.");
  });
}

// ─── پیام‌ها ───────────────────────────────────────────────────

export async function toggleMessageRead(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
    const message = await prisma.contactMessage.findUniqueOrThrow({ where: { id } });
    await prisma.contactMessage.update({ where: { id }, data: { isRead: !message.isRead } });
    revalidatePath("/admin/messages");
    return OK(message.isRead ? "به‌عنوان خوانده‌نشده علامت خورد." : "به‌عنوان خوانده‌شده علامت خورد.");
  });
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    await prisma.contactMessage.delete({ where: { id } });
    revalidatePath("/admin/messages");
    return OK("پیام حذف شد.");
  });
}

// ─── محتوا: خدمات / پرسنل / گالری / مجله ───────────────────────

export async function toggleServiceActive(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    const service = await prisma.service.findUniqueOrThrow({ where: { id } });
    await prisma.service.update({ where: { id }, data: { isActive: !service.isActive } });
    revalidatePath("/admin/services");
    revalidatePath("/services");
    return OK(service.isActive ? "خدمت غیرفعال شد." : "خدمت فعال شد.");
  });
}

export async function toggleServiceFeatured(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    const service = await prisma.service.findUniqueOrThrow({ where: { id } });
    await prisma.service.update({ where: { id }, data: { isFeatured: !service.isFeatured } });
    revalidatePath("/admin/services");
    revalidatePath("/");
    return OK(service.isFeatured ? "از منتخب‌ها برداشته شد." : "به منتخب‌ها اضافه شد.");
  });
}

export async function updateServicePricing(
  id: string,
  data: { priceFrom: number | null; priceTo: number | null; durationMinutes: number }
): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    if (data.durationMinutes < 5 || data.durationMinutes > 600) {
      return FAIL("مدت جلسه باید بین ۵ تا ۶۰۰ دقیقه باشد.");
    }
    if (data.priceFrom !== null && data.priceTo !== null && data.priceFrom > data.priceTo) {
      return FAIL("حداقل قیمت نمی‌تواند از حداکثر بیشتر باشد.");
    }
    await prisma.service.update({ where: { id }, data });
    revalidatePath("/admin/services");
    revalidatePath("/services");
    return OK("اطلاعات خدمت به‌روزرسانی شد.");
  });
}

export async function toggleStaffActive(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    const member = await prisma.staff.findUniqueOrThrow({ where: { id } });
    await prisma.staff.update({ where: { id }, data: { isActive: !member.isActive } });
    revalidatePath("/admin/staff");
    revalidatePath("/about");
    return OK(member.isActive ? "پرسنل غیرفعال شد." : "پرسنل فعال شد.");
  });
}

export async function toggleGalleryPublished(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    const item = await prisma.galleryItem.findUniqueOrThrow({ where: { id } });
    await prisma.galleryItem.update({ where: { id }, data: { isPublished: !item.isPublished } });
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    return OK(item.isPublished ? "از گالری برداشته شد." : "در گالری منتشر شد.");
  });
}

export async function deleteGalleryItem(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    await prisma.galleryItem.delete({ where: { id } });
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    return OK("نمونه‌کار حذف شد.");
  });
}

export async function togglePostPublished(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    const post = await prisma.post.findUniqueOrThrow({ where: { id } });
    await prisma.post.update({
      where: { id },
      data: {
        isPublished: !post.isPublished,
        publishedAt: post.publishedAt ?? new Date(),
      },
    });
    revalidatePath("/admin/blog");
    revalidatePath("/blog");
    return OK(post.isPublished ? "مقاله پیش‌نویس شد." : "مقاله منتشر شد.");
  });
}

export async function deletePost(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    await prisma.post.delete({ where: { id } });
    revalidatePath("/admin/blog");
    revalidatePath("/blog");
    return OK("مقاله حذف شد.");
  });
}

// ─── تنظیمات ───────────────────────────────────────────────────

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireRole("ADMIN", "MANAGER");
    const values: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") values[key] = value.trim();
    }
    await setSettings(values);
    await logAction({ userId: user.id, action: "settings.save", entity: "Setting" });
    revalidatePath("/", "layout");
    return OK("تنظیمات ذخیره شد.");
  });
}

export async function saveWorkingHours(formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await requireRole("ADMIN", "MANAGER");
    for (let weekday = 0; weekday <= 6; weekday++) {
      const isOpen = formData.get(`open-${weekday}`) === "on";
      const startTime = String(formData.get(`start-${weekday}`) || "09:00");
      const endTime = String(formData.get(`end-${weekday}`) || "21:00");
      if (startTime >= endTime && isOpen) {
        return FAIL("ساعت پایان باید بعد از ساعت شروع باشد.");
      }
      await prisma.workingHour.upsert({
        where: { weekday },
        create: { weekday, isOpen, startTime, endTime },
        update: { isOpen, startTime, endTime },
      });
    }
    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
    return OK("ساعات کاری ذخیره شد.");
  });
}
