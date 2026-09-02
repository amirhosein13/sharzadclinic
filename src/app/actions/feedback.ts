"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import { feedbackSchema, fieldErrors } from "@/lib/validators";
import {
  newFeedbackToken, sanitizeAspects, UNHAPPY_THRESHOLD,
} from "@/lib/feedback";
import { notifyFeedbackRequest } from "@/lib/notifications";
import { safeRevalidate } from "@/lib/revalidate";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * ساخت (یا برداشتن) دعوت‌نامه‌ی نظرسنجیِ یک نوبت. هر نوبت فقط یک نظرسنجی
 * دارد، پس چند بار صدا زدنش رکورد تکراری نمی‌سازد.
 */
export async function ensureFeedbackInvite(appointmentId: string) {
  const existing = await prisma.feedback.findUnique({ where: { appointmentId } });
  if (existing) return existing;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { customerId: true, serviceId: true, staffId: true, status: true },
  });
  if (!appointment || appointment.status !== "DONE") return null;

  return prisma.feedback.create({
    data: {
      customerId: appointment.customerId,
      appointmentId,
      serviceId: appointment.serviceId,
      staffId: appointment.staffId,
      token: newFeedbackToken(),
    },
  });
}

/** ارسال پیامک نظرسنجی برای یک نوبت انجام‌شده */
export async function sendFeedbackRequest(appointmentId: string): Promise<FormResult> {
  try {
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
  } catch {
    return FAIL("برای این کار دسترسی ندارید.");
  }

  try {
    const invite = await ensureFeedbackInvite(appointmentId);
    if (!invite) return FAIL("فقط برای نوبت‌های انجام‌شده می‌توان نظرسنجی فرستاد.");

    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        service: { select: { title: true } },
      },
    });

    const result = await notifyFeedbackRequest({
      phone: appointment.customer.phone,
      customerName: `${appointment.customer.firstName} ${appointment.customer.lastName}`,
      serviceTitle: appointment.service.title,
      url: `${siteUrl()}/feedback/${invite.token}`,
    });

    await prisma.feedback.update({ where: { id: invite.id }, data: { sentAt: new Date() } });
    revalidatePath("/admin/feedback");
    revalidatePath("/admin/appointments");

    return result.ok
      ? OK("پیامک نظرسنجی ارسال شد.")
      : OK("لینک نظرسنجی ساخته شد، ولی پیامک ارسال نشد. تنظیمات پیامک را بررسی کنید.");
  } catch (error) {
    console.error(error);
    return FAIL("ارسال نظرسنجی با خطا مواجه شد.");
  }
}

/** ثبت نظر توسط مشتری — بدون نیاز به ورود، فقط با توکنِ داخل پیامک */
export async function submitFeedback(formData: FormData): Promise<FormResult> {
  const parsed = feedbackSchema.safeParse({
    token: text(formData.get("token")),
    rating: text(formData.get("rating")),
    goodTags: formData.getAll("goodTags").map(String),
    badTags: formData.getAll("badTags").map(String),
    comment: text(formData.get("comment")),
    wouldRecommend: text(formData.get("wouldRecommend")),
    canPublish: formData.get("canPublish") === "on",
  });
  if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

  const v = parsed.data;
  try {
    const invite = await prisma.feedback.findUnique({
      where: { token: v.token },
      select: { id: true, submittedAt: true, customerId: true, appointmentId: true },
    });
    if (!invite) return FAIL("این لینک نظرسنجی معتبر نیست.");
    if (invite.submittedAt) return FAIL("نظر شما قبلاً ثبت شده است. ممنون از وقتی که گذاشتید.");

    // یک جنبه نمی‌تواند هم‌زمان خوب و بد باشد؛ انتخاب منفی مهم‌تر است،
    // چون شکایت مبنای گزارش و پیگیری مدیر است و نباید بی‌صدا حذف شود
    const bad = sanitizeAspects(v.badTags ?? []);
    const good = sanitizeAspects(v.goodTags ?? []).filter((t) => !bad.includes(t));

    await prisma.feedback.update({
      where: { id: invite.id },
      data: {
        rating: v.rating,
        goodTags: good,
        badTags: bad,
        comment: v.comment?.trim() || null,
        wouldRecommend: v.wouldRecommend === "yes" ? true : v.wouldRecommend === "no" ? false : null,
        canPublish: v.canPublish ?? false,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    // نارضایتی باید تبدیل به یک تماس واقعی شود، نه یک عدد در گزارش
    if (v.rating <= UNHAPPY_THRESHOLD) {
      await prisma.followUp.create({
        data: {
          customerId: invite.customerId,
          appointmentId: invite.appointmentId,
          kind: "POST_CARE",
          dueAt: new Date(),
          reason: `نارضایتی در نظرسنجی (امتیاز ${v.rating} از ۵)`,
        },
      });
    }

    safeRevalidate("/admin/feedback", "/admin/followups");
    return OK(
      v.rating <= UNHAPPY_THRESHOLD
        ? "نظر شما ثبت شد. از این‌که گفتید سپاسگزاریم — همکاران ما پیگیری می‌کنند."
        : "نظر شما ثبت شد. ممنون از وقتی که گذاشتید.",
    );
  } catch (error) {
    console.error(error);
    return FAIL("ثبت نظر با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
  }
}

/* ── رسیدگی مدیر ─────────────────────────────────────────── */

async function guardManager<T>(fn: () => Promise<T>) {
  try {
    await requireRole("ADMIN", "MANAGER");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("فقط مدیر به نظرسنجی‌ها دسترسی دارد.");
    console.error(error);
    return FAIL("انجام این کار با خطا مواجه شد.");
  }
}

export async function setFeedbackStatus(
  id: string,
  status: "SEEN" | "RESOLVED",
  note?: string,
): Promise<FormResult> {
  return guardManager(async () => {
    await prisma.feedback.update({
      where: { id },
      data: {
        status,
        managerNote: note?.trim() || undefined,
        handledAt: status === "RESOLVED" ? new Date() : undefined,
      },
    });
    await logAction({ action: `feedback.${status.toLowerCase()}`, entity: "Feedback", entityId: id });
    revalidatePath("/admin/feedback");
    return OK(status === "RESOLVED" ? "به‌عنوان رسیدگی‌شده ثبت شد." : "علامت خورد که دیده‌اید.");
  }) as Promise<FormResult>;
}

export async function saveFeedbackNote(formData: FormData): Promise<FormResult> {
  return guardManager(async () => {
    const id = text(formData.get("id"));
    const note = text(formData.get("managerNote")).trim();
    await prisma.feedback.update({ where: { id }, data: { managerNote: note || null } });
    revalidatePath("/admin/feedback");
    return OK("یادداشت ذخیره شد.");
  }) as Promise<FormResult>;
}

/** انتشار نظر مشتری در صفحه‌ی نظرات سایت */
export async function publishFeedback(id: string): Promise<FormResult> {
  return guardManager(async () => {
    const feedback = await prisma.feedback.findUniqueOrThrow({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { title: true } },
      },
    });

    if (!feedback.canPublish) return FAIL("مشتری اجازه‌ی انتشار این نظر را نداده است.");
    if (!feedback.comment) return FAIL("این نظر متنی ندارد که منتشر شود.");

    await prisma.testimonial.create({
      data: {
        customerId: feedback.customer.id,
        authorName: `${feedback.customer.firstName} ${feedback.customer.lastName}`,
        serviceName: feedback.service?.title ?? null,
        rating: feedback.rating ?? 5,
        body: feedback.comment,
        isApproved: false,
      },
    });

    revalidatePath("/admin/testimonials");
    return OK("به بخش نظرات اضافه شد. پس از تأیید در سایت نمایش داده می‌شود.");
  }) as Promise<FormResult>;
}
