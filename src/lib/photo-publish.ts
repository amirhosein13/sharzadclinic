import "server-only";
import { prisma } from "./prisma";

/**
 * اجازه‌ی انتشار عکس قبل/بعد.
 *
 * عکس‌های پرونده به‌صورت پیش‌فرض کاملاً خصوصی‌اند. فقط وقتی مشتری صریحاً
 * — و جدا از خودِ رضایت‌نامه‌ی درمان — اجازه بدهد، عکسش نامزدِ انتشار
 * می‌شود. حتی آن‌وقت هم مستقیم روی سایت نمی‌رود: به گالری «منتشرنشده»
 * اضافه می‌شود تا مدیر خودش ببیند و تأیید کند.
 */

export type PublishCandidate = {
  treatmentId: string;
  customerId: string;
  customerName: string;
  serviceTitle: string;
  serviceSlug: string | null;
  performedAt: Date;
  beforePhoto: string;
  afterPhoto: string;
};

/**
 * پرونده‌هایی که هم عکس قبل دارند هم بعد، مشتری‌شان اجازه داده، و هنوز
 * به گالری اضافه نشده‌اند.
 */
export async function publishCandidates(limit = 30): Promise<PublishCandidate[]> {
  const rows = await prisma.treatmentRecord.findMany({
    where: {
      beforePhoto: { not: null },
      afterPhoto: { not: null },
      customer: { photoPublishAllowed: true },
      // آن‌هایی که قبلاً به گالری رفته‌اند دوباره پیشنهاد نمی‌شوند
      id: { notIn: await usedTreatmentIds() },
    },
    orderBy: { performedAt: "desc" },
    take: limit,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      service: { select: { title: true, slug: true } },
    },
  });

  return rows.map((r) => ({
    treatmentId: r.id,
    customerId: r.customer.id,
    customerName: `${r.customer.firstName} ${r.customer.lastName}`,
    serviceTitle: r.service?.title ?? "درمان",
    serviceSlug: r.service?.slug ?? null,
    performedAt: r.performedAt,
    beforePhoto: r.beforePhoto!,
    afterPhoto: r.afterPhoto!,
  }));
}

async function usedTreatmentIds(): Promise<string[]> {
  const rows = await prisma.galleryItem.findMany({
    where: { treatmentId: { not: null } },
    select: { treatmentId: true },
  });
  return rows.map((r) => r.treatmentId!);
}

export type PromoteResult = { ok: true; galleryId: string } | { ok: false; message: string };

/**
 * افزودن یک پرونده به گالری — به‌صورت منتشرنشده.
 *
 * عنوان عمداً فقط نام خدمت است و هیچ اشاره‌ای به نام مشتری ندارد؛ اجازه‌ی
 * انتشار عکس، اجازه‌ی افشای هویت نیست.
 */
export async function promoteToGallery(treatmentId: string): Promise<PromoteResult> {
  const treatment = await prisma.treatmentRecord.findUnique({
    where: { id: treatmentId },
    include: {
      customer: { select: { photoPublishAllowed: true } },
      service: { select: { title: true, slug: true } },
    },
  });

  if (!treatment) return { ok: false, message: "پرونده پیدا نشد." };
  if (!treatment.beforePhoto || !treatment.afterPhoto) {
    return { ok: false, message: "این پرونده هر دو عکس قبل و بعد را ندارد." };
  }
  // دوباره چک می‌کنیم؛ ممکن است بین دیدن فهرست و کلیک، رضایت پس گرفته شده باشد
  if (treatment.customer.photoPublishAllowed !== true) {
    return { ok: false, message: "این مشتری اجازه‌ی انتشار عکس نداده است." };
  }

  const exists = await prisma.galleryItem.findUnique({ where: { treatmentId } });
  if (exists) return { ok: false, message: "این پرونده قبلاً به گالری اضافه شده است." };

  const item = await prisma.galleryItem.create({
    data: {
      treatmentId,
      title: treatment.service?.title ?? "نمونه کار",
      beforeImage: treatment.beforePhoto,
      afterImage: treatment.afterPhoto,
      serviceSlug: treatment.service?.slug ?? null,
      // منتشرنشده می‌ماند تا مدیر خودش ببیند و تأیید کند
      isPublished: false,
    },
  });

  return { ok: true, galleryId: item.id };
}

/**
 * وقتی مشتری رضایتش را پس می‌گیرد، عکس‌هایش باید از سایت برداشته شوند —
 * وگرنه «هر وقت بخواهید پس بگیرید» حرف توخالی است.
 */
export async function withdrawPhotoConsent(customerId: string): Promise<number> {
  await prisma.customer.update({
    where: { id: customerId },
    data: { photoPublishAllowed: false },
  });

  const treatments = await prisma.treatmentRecord.findMany({
    where: { customerId },
    select: { id: true },
  });

  const result = await prisma.galleryItem.updateMany({
    where: { treatmentId: { in: treatments.map((t) => t.id) }, isPublished: true },
    data: { isPublished: false },
  });

  return result.count;
}
