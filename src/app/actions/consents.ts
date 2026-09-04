"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import { consentSignatureSchema, consentTemplateSchema, fieldErrors } from "@/lib/validators";
import { renderConsentBody } from "@/lib/consents";
import { slugify } from "@/lib/utils";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const nullable = (v: string | undefined | null) => (v && v.trim() !== "" ? v.trim() : null);

async function guard<T>(roles: Parameters<typeof requireRole>, fn: () => Promise<T>) {
  try {
    await requireRole(...roles);
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("برای این کار دسترسی ندارید.");
    if (message.includes("Unique constraint")) {
      return FAIL("رضایت‌نامه‌ای با همین نشانی وجود دارد. عنوان را تغییر دهید.");
    }
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد. دوباره تلاش کنید.");
  }
}

/* ── قالب رضایت‌نامه — فقط مدیر ─────────────────────────────── */

export async function saveConsentTemplate(formData: FormData): Promise<FormResult> {
  return guard(["ADMIN", "MANAGER"], async () => {
    const id = text(formData.get("id"));
    const parsed = consentTemplateSchema.safeParse({
      title: text(formData.get("title")),
      slug: text(formData.get("slug")),
      body: text(formData.get("body")),
      order: text(formData.get("order")),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const slug = slugify(v.slug || v.title);
    const data = {
      title: v.title,
      slug,
      body: v.body,
      order: v.order,
      isActive: v.isActive ?? false,
    };

    // خدمات مرتبط: خالی یعنی رضایت‌نامه‌ی عمومی
    const serviceIds = formData
      .getAll("serviceIds")
      .filter((v): v is string => typeof v === "string" && v !== "");

    const saved = id
      ? await prisma.consentTemplate.update({ where: { id }, data })
      : await prisma.consentTemplate.create({ data });

    await prisma.$transaction([
      prisma.consentTemplateService.deleteMany({ where: { templateId: saved.id } }),
      prisma.consentTemplateService.createMany({
        data: serviceIds.map((serviceId) => ({ templateId: saved.id, serviceId })),
        skipDuplicates: true,
      }),
    ]);

    await logAction({ action: id ? "update" : "create", entity: "consentTemplate", entityId: saved.id });
    revalidatePath("/admin/consents");
    return OK(id ? "رضایت‌نامه به‌روزرسانی شد." : "رضایت‌نامه ساخته شد.");
  }) as Promise<FormResult>;
}

export async function toggleConsentTemplate(id: string): Promise<FormResult> {
  return guard(["ADMIN", "MANAGER"], async () => {
    const current = await prisma.consentTemplate.findUniqueOrThrow({ where: { id } });
    await prisma.consentTemplate.update({ where: { id }, data: { isActive: !current.isActive } });
    revalidatePath("/admin/consents");
    return OK(current.isActive ? "رضایت‌نامه غیرفعال شد." : "رضایت‌نامه فعال شد.");
  }) as Promise<FormResult>;
}

export async function deleteConsentTemplate(id: string): Promise<FormResult> {
  return guard(["ADMIN", "MANAGER"], async () => {
    const signed = await prisma.consentSignature.count({ where: { templateId: id } });
    if (signed > 0) {
      return FAIL("این رضایت‌نامه امضا شده و حذفش سوابق را از بین می‌برد. به‌جایش غیرفعالش کنید.");
    }
    await prisma.consentTemplate.delete({ where: { id } });
    await logAction({ action: "delete", entity: "consentTemplate", entityId: id });
    revalidatePath("/admin/consents");
    return OK("رضایت‌نامه حذف شد.");
  }) as Promise<FormResult>;
}

/* ── امضا — منشی هم انجام می‌دهد ────────────────────────────── */

export async function signConsent(formData: FormData): Promise<FormResult> {
  return guard(["ADMIN", "MANAGER", "RECEPTION"], async () => {
    const parsed = consentSignatureSchema.safeParse({
      customerId: text(formData.get("customerId")),
      templateId: text(formData.get("templateId")),
      fullName: text(formData.get("fullName")),
      nationalCode: text(formData.get("nationalCode")),
      signatureData: text(formData.get("signatureData")),
      agreed: formData.get("agreed") === "on",
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const template = await prisma.consentTemplate.findUnique({ where: { id: v.templateId } });
    if (!template) return FAIL("رضایت‌نامه پیدا نشد.", { templateId: "دوباره انتخاب کنید" });

    const signedAt = new Date();
    // متن را همین‌جا ثابت می‌کنیم تا ویرایش بعدی قالب، سند امضاشده را عوض نکند
    const bodySnapshot = await renderConsentBody(template.body, {
      fullName: v.fullName,
      nationalCode: v.nationalCode,
      signedAt,
    });

    const signature = await prisma.consentSignature.create({
      data: {
        templateId: template.id,
        customerId: v.customerId,
        fullName: v.fullName,
        nationalCode: nullable(v.nationalCode),
        signatureData: nullable(v.signatureData),
        bodySnapshot,
        signedAt,
      },
    });

    await logAction({
      action: "sign",
      entity: "consentSignature",
      entityId: signature.id,
      detail: template.title,
    });
    revalidatePath(`/admin/customers/${v.customerId}`);
    revalidatePath("/account");
    return OK("رضایت‌نامه ثبت شد.");
  }) as Promise<FormResult>;
}

export async function deleteConsentSignature(id: string): Promise<FormResult> {
  return guard(["ADMIN", "MANAGER"], async () => {
    const removed = await prisma.consentSignature.delete({ where: { id } });
    await logAction({ action: "delete", entity: "consentSignature", entityId: id });
    revalidatePath(`/admin/customers/${removed.customerId}`);
    revalidatePath("/account");
    return OK("رضایت‌نامه حذف شد.");
  }) as Promise<FormResult>;
}
