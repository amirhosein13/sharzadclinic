"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import {
  categorySchema, fieldErrors, galleryItemSchema, postSchema,
  serviceSchema, staffScheduleSchema, staffSchema,
} from "@/lib/validators";
import { readingTime, slugify, toFa } from "@/lib/utils";
import type { z } from "zod";

export type FormResult = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
};

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

/** فقط مدیر و مدیر کل اجازه‌ی تغییر محتوای سایت را دارند */
async function guardContent<T>(fn: () => Promise<T>): Promise<T | FormResult> {
  try {
    await requireRole("ADMIN", "MANAGER");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("فقط مدیر کلینیک می‌تواند محتوا را تغییر دهد.");
    if (message.includes("Unique constraint")) {
      return FAIL("رکوردی با همین نشانی (slug) از قبل وجود دارد. عنوان یا نشانی را تغییر دهید.");
    }
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
  }
}

const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const nullable = (v: string | undefined | null) => (v && v.trim() !== "" ? v.trim() : null);

/** نشانی یکتا می‌سازد؛ اگر تکراری بود عدد اضافه می‌کند */
async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
  currentId?: string
): Promise<string> {
  const seed = slugify(base) || `item-${Date.now()}`;
  let candidate = seed;
  for (let i = 2; i < 60; i++) {
    if (!(await exists(candidate))) return candidate;
    candidate = `${seed}-${i}`;
  }
  return `${seed}-${currentId ?? Date.now()}`;
}

// ─── خدمات ─────────────────────────────────────────────────────

export async function saveService(formData: FormData): Promise<FormResult> {
  return guardContent(async () => {
    const id = text(formData.get("id"));
    const parsed = serviceSchema.safeParse({
      title: text(formData.get("title")),
      slug: text(formData.get("slug")),
      categoryId: text(formData.get("categoryId")),
      shortDescription: text(formData.get("shortDescription")),
      description: text(formData.get("description")),
      image: text(formData.get("image")),
      priceFrom: text(formData.get("priceFrom")),
      priceTo: text(formData.get("priceTo")),
      durationMinutes: text(formData.get("durationMinutes")),
      bufferMinutes: text(formData.get("bufferMinutes")),
      slotStepMinutes: text(formData.get("slotStepMinutes")),
      depositAmount: text(formData.get("depositAmount")),
      sessionsNeeded: text(formData.get("sessionsNeeded")),
      preparation: text(formData.get("preparation")),
      aftercare: text(formData.get("aftercare")),
      isFeatured: bool(formData.get("isFeatured")),
      isBookable: bool(formData.get("isBookable")),
      isActive: bool(formData.get("isActive")),
      order: text(formData.get("order")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const slug = await uniqueSlug(
      v.slug || v.title,
      async (s) => !!(await prisma.service.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })),
      id
    );

    const data = {
      title: v.title,
      categoryId: v.categoryId,
      shortDescription: nullable(v.shortDescription),
      description: nullable(v.description),
      image: nullable(v.image),
      priceFrom: v.priceFrom,
      priceTo: v.priceTo,
      durationMinutes: v.durationMinutes,
      bufferMinutes: v.bufferMinutes,
      slotStepMinutes: v.slotStepMinutes,
      depositAmount: v.depositAmount,
      sessionsNeeded: nullable(v.sessionsNeeded),
      preparation: nullable(v.preparation),
      aftercare: nullable(v.aftercare),
      isFeatured: !!v.isFeatured,
      isBookable: !!v.isBookable,
      isActive: !!v.isActive,
      order: v.order ?? 0,
      metaTitle: v.title,
      metaDescription: nullable(v.shortDescription),
    };

    const saved = id
      ? await prisma.service.update({ where: { id }, data })
      : await prisma.service.create({ data: { slug, ...data } });

    // پرسنل مجاز برای این خدمت
    const staffIds = formData.getAll("staffIds").map(String).filter(Boolean);
    await prisma.staffOnService.deleteMany({ where: { serviceId: saved.id } });
    if (staffIds.length) {
      await prisma.staffOnService.createMany({
        data: staffIds.map((staffId) => ({ staffId, serviceId: saved.id })),
        skipDuplicates: true,
      });
    }

    await logAction({ action: id ? "service.update" : "service.create", entity: "Service", entityId: saved.id });
    revalidatePath("/admin/services");
    revalidatePath("/services");
    revalidatePath("/");
    return OK(id ? "خدمت به‌روزرسانی شد." : "خدمت جدید ثبت شد.");
  }) as Promise<FormResult>;
}

export async function deleteService(id: string): Promise<FormResult> {
  return guardContent(async () => {
    const count = await prisma.appointment.count({ where: { serviceId: id } });
    if (count > 0) {
      return FAIL(
        `این خدمت ${toFa(count)} نوبت ثبت‌شده دارد و حذف نمی‌شود. به‌جای حذف، غیرفعالش کنید.`
      );
    }
    await prisma.service.delete({ where: { id } });
    revalidatePath("/admin/services");
    revalidatePath("/services");
    return OK("خدمت حذف شد.");
  }) as Promise<FormResult>;
}

// ─── دسته‌بندی خدمات ───────────────────────────────────────────

export async function saveCategory(formData: FormData): Promise<FormResult> {
  return guardContent(async () => {
    const id = text(formData.get("id"));
    const parsed = categorySchema.safeParse({
      title: text(formData.get("title")),
      slug: text(formData.get("slug")),
      description: text(formData.get("description")),
      icon: text(formData.get("icon")),
      order: text(formData.get("order")),
      isActive: bool(formData.get("isActive")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const slug = await uniqueSlug(
      v.slug || v.title,
      async (s) => !!(await prisma.serviceCategory.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })),
      id
    );
    const data = {
      title: v.title,
      description: nullable(v.description),
      icon: nullable(v.icon),
      order: v.order ?? 0,
      isActive: !!v.isActive,
    };

    if (id) await prisma.serviceCategory.update({ where: { id }, data });
    else await prisma.serviceCategory.create({ data: { slug, ...data } });

    revalidatePath("/admin/services");
    revalidatePath("/services");
    return OK(id ? "دسته‌بندی به‌روزرسانی شد." : "دسته‌بندی جدید ثبت شد.");
  }) as Promise<FormResult>;
}

export async function deleteCategory(id: string): Promise<FormResult> {
  return guardContent(async () => {
    const count = await prisma.service.count({ where: { categoryId: id } });
    if (count > 0) {
      return FAIL(`این دسته‌بندی ${toFa(count)} خدمت دارد. اول خدمات را به دسته‌ی دیگری منتقل کنید.`);
    }
    await prisma.serviceCategory.delete({ where: { id } });
    revalidatePath("/admin/services");
    revalidatePath("/services");
    return OK("دسته‌بندی حذف شد.");
  }) as Promise<FormResult>;
}

// ─── پرسنل ─────────────────────────────────────────────────────

export async function saveStaff(formData: FormData): Promise<FormResult> {
  return guardContent(async () => {
    const id = text(formData.get("id"));
    const parsed = staffSchema.safeParse({
      name: text(formData.get("name")),
      slug: text(formData.get("slug")),
      title: text(formData.get("title")),
      bio: text(formData.get("bio")),
      avatar: text(formData.get("avatar")),
      licenseNo: text(formData.get("licenseNo")),
      instagram: text(formData.get("instagram")),
      baseSalary: text(formData.get("baseSalary")),
      commissionPercent: text(formData.get("commissionPercent")) || "0",
      order: text(formData.get("order")),
      isActive: bool(formData.get("isActive")),
      acceptsBookings: bool(formData.get("acceptsBookings")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const slug = await uniqueSlug(
      v.slug || v.name,
      async (s) => !!(await prisma.staff.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })),
      id
    );
    const data = {
      name: v.name,
      title: v.title,
      bio: nullable(v.bio),
      avatar: nullable(v.avatar),
      licenseNo: nullable(v.licenseNo),
      instagram: nullable(v.instagram),
      baseSalary: v.baseSalary ?? 0,
      commissionPercent: v.commissionPercent,
      order: v.order ?? 0,
      isActive: !!v.isActive,
      acceptsBookings: !!v.acceptsBookings,
    };

    const saved = id
      ? await prisma.staff.update({ where: { id }, data })
      : await prisma.staff.create({ data: { slug, ...data } });

    const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);
    await prisma.staffOnService.deleteMany({ where: { staffId: saved.id } });
    if (serviceIds.length) {
      await prisma.staffOnService.createMany({
        data: serviceIds.map((serviceId) => ({ staffId: saved.id, serviceId })),
        skipDuplicates: true,
      });
    }

    revalidatePath("/admin/staff");
    revalidatePath("/about");
    return OK(id ? "اطلاعات پرسنل به‌روزرسانی شد." : "پرسنل جدید ثبت شد.");
  }) as Promise<FormResult>;
}

export async function deleteStaff(id: string): Promise<FormResult> {
  return guardContent(async () => {
    const count = await prisma.appointment.count({ where: { staffId: id } });
    if (count > 0) {
      return FAIL(`این پرسنل ${toFa(count)} نوبت ثبت‌شده دارد و حذف نمی‌شود. به‌جای حذف، غیرفعالش کنید.`);
    }
    await prisma.staff.delete({ where: { id } });
    revalidatePath("/admin/staff");
    revalidatePath("/about");
    return OK("پرسنل حذف شد.");
  }) as Promise<FormResult>;
}

// ─── برنامه‌ی هفتگی پرسنل ──────────────────────────────────────

export async function saveStaffSchedule(formData: FormData): Promise<FormResult> {
  return guardContent(async () => {
    const staffId = text(formData.get("staffId"));
    await prisma.staffSchedule.deleteMany({ where: { staffId } });

    const rows: { weekday: number; startTime: string; endTime: string }[] = [];
    for (let weekday = 0; weekday <= 6; weekday++) {
      if (!bool(formData.get(`active-${weekday}`))) continue;
      const parsed = staffScheduleSchema.safeParse({
        staffId,
        weekday: String(weekday),
        startTime: text(formData.get(`start-${weekday}`)),
        endTime: text(formData.get(`end-${weekday}`)),
      });
      if (!parsed.success) {
        return FAIL(parsed.error.issues[0]?.message ?? "ساعت‌های واردشده نامعتبر است.");
      }
      rows.push({
        weekday,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
      });
    }

    if (rows.length) {
      await prisma.staffSchedule.createMany({ data: rows.map((r) => ({ staffId, ...r })) });
    }
    revalidatePath("/admin/staff");
    return OK(
      rows.length
        ? "برنامه‌ی هفتگی ذخیره شد."
        : "برنامه‌ی هفتگی خالی شد — این پرسنل در رزرو آنلاین نمایش داده نمی‌شود."
    );
  }) as Promise<FormResult>;
}

// ─── گالری ─────────────────────────────────────────────────────

export async function saveGalleryItem(formData: FormData): Promise<FormResult> {
  return guardContent(async () => {
    const id = text(formData.get("id"));
    const parsed = galleryItemSchema.safeParse({
      title: text(formData.get("title")),
      description: text(formData.get("description")),
      beforeImage: text(formData.get("beforeImage")),
      afterImage: text(formData.get("afterImage")),
      serviceSlug: text(formData.get("serviceSlug")),
      order: text(formData.get("order")),
      isPublished: bool(formData.get("isPublished")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const data = {
      title: v.title,
      description: nullable(v.description),
      beforeImage: v.beforeImage,
      afterImage: nullable(v.afterImage),
      serviceSlug: nullable(v.serviceSlug),
      order: v.order ?? 0,
      isPublished: !!v.isPublished,
    };

    if (id) await prisma.galleryItem.update({ where: { id }, data });
    else await prisma.galleryItem.create({ data });

    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    revalidatePath("/");
    return OK(id ? "نمونه‌کار به‌روزرسانی شد." : "نمونه‌کار جدید ثبت شد.");
  }) as Promise<FormResult>;
}

// ─── مجله ──────────────────────────────────────────────────────

export async function savePost(formData: FormData): Promise<FormResult> {
  return guardContent(async () => {
    const id = text(formData.get("id"));
    const parsed = postSchema.safeParse({
      title: text(formData.get("title")),
      slug: text(formData.get("slug")),
      excerpt: text(formData.get("excerpt")),
      content: text(formData.get("content")),
      coverImage: text(formData.get("coverImage")),
      categoryId: text(formData.get("categoryId")),
      isPublished: bool(formData.get("isPublished")),
      metaTitle: text(formData.get("metaTitle")),
      metaDescription: text(formData.get("metaDescription")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const slug = await uniqueSlug(
      v.slug || v.title,
      async (s) => !!(await prisma.post.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })),
      id
    );

    const existing = id ? await prisma.post.findUnique({ where: { id } }) : null;
    const data = {
      title: v.title,
      excerpt: nullable(v.excerpt),
      content: v.content,
      coverImage: nullable(v.coverImage),
      categoryId: nullable(v.categoryId),
      readingMinutes: readingTime(v.content),
      isPublished: !!v.isPublished,
      publishedAt: v.isPublished ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
      metaTitle: nullable(v.metaTitle) ?? v.title,
      metaDescription: nullable(v.metaDescription) ?? nullable(v.excerpt),
    };

    if (id) await prisma.post.update({ where: { id }, data });
    else await prisma.post.create({ data: { slug, ...data } });

    revalidatePath("/admin/blog");
    revalidatePath("/blog");
    revalidatePath("/");
    return OK(id ? "مقاله به‌روزرسانی شد." : "مقاله جدید ثبت شد.");
  }) as Promise<FormResult>;
}

// ─── پرسش‌های متداول هر خدمت ───────────────────────────────────

export async function saveServiceFaqs(formData: FormData): Promise<FormResult> {
  return guardContent(async () => {
    const serviceId = text(formData.get("serviceId"));
    const questions = formData.getAll("question").map(String);
    const answers = formData.getAll("answer").map(String);

    await prisma.serviceFaq.deleteMany({ where: { serviceId } });
    const rows = questions
      .map((question, i) => ({ question: question.trim(), answer: (answers[i] ?? "").trim(), order: i }))
      .filter((r) => r.question && r.answer);

    if (rows.length) {
      await prisma.serviceFaq.createMany({ data: rows.map((r) => ({ serviceId, ...r })) });
    }
    revalidatePath("/admin/services");
    revalidatePath("/services");
    return OK("سوالات متداول ذخیره شد.");
  }) as Promise<FormResult>;
}

export type ServiceInput = z.infer<typeof serviceSchema>;
