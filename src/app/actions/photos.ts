"use server";

import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { promoteToGallery, withdrawPhotoConsent } from "@/lib/photo-publish";
import { safeRevalidate } from "@/lib/revalidate";
import { toFa } from "@/lib/utils";
import type { FormResult } from "./content";

/** افزودن یک پرونده‌ی درمانی به گالری — منتشرنشده، تا مدیر تأیید کند */
export async function addToGallery(treatmentId: string): Promise<FormResult> {
  try {
    const user = await requireRole("ADMIN", "MANAGER");
    const result = await promoteToGallery(treatmentId);
    if (!result.ok) return { ok: false, message: result.message };

    await logAction({
      userId: user.id,
      action: "gallery.fromTreatment",
      entity: "GalleryItem",
      entityId: result.galleryId,
      detail: treatmentId,
    });

    safeRevalidate("/admin/gallery");
    return {
      ok: true,
      message: "به گالری اضافه شد — هنوز منتشر نشده. عنوان و توضیحش را بنویسید و بعد منتشرش کنید.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FORBIDDEN") return { ok: false, message: "برای این کار دسترسی ندارید." };
    console.error(error);
    return { ok: false, message: "انجام نشد." };
  }
}

/** پس‌گرفتن اجازه‌ی انتشار توسط پنل (به‌درخواست تلفنی مشتری) */
export async function revokePhotoConsent(customerId: string): Promise<FormResult> {
  try {
    const user = await requireRole("ADMIN", "MANAGER", "RECEPTION");
    const hidden = await withdrawPhotoConsent(customerId);

    await logAction({
      userId: user.id,
      action: "photo.revoke",
      entity: "Customer",
      entityId: customerId,
      detail: hidden > 0 ? `${hidden} عکس از سایت برداشته شد` : "عکسی در سایت نبود",
    });

    safeRevalidate(`/admin/customers/${customerId}`);
    safeRevalidate("/admin/gallery");
    safeRevalidate("/gallery");
    return {
      ok: true,
      message:
        hidden > 0
          ? `اجازه پس گرفته شد و ${toFa(hidden)} عکس از سایت برداشته شد.`
          : "اجازه‌ی انتشار پس گرفته شد.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FORBIDDEN") return { ok: false, message: "برای این کار دسترسی ندارید." };
    console.error(error);
    return { ok: false, message: "انجام نشد." };
  }
}

/** خودِ مشتری از پنلش اجازه را پس می‌گیرد یا می‌دهد */
export async function setMyPhotoConsent(allow: boolean): Promise<FormResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, message: "برای این کار باید وارد حسابتان شوید." };

  if (allow) {
    await prisma.customer.update({
      where: { id: session.id },
      data: { photoPublishAllowed: true },
    });
    safeRevalidate("/account");
    return { ok: true, message: "اجازه‌ی انتشار عکس ثبت شد. هر وقت خواستید می‌توانید پسش بگیرید." };
  }

  const hidden = await withdrawPhotoConsent(session.id);
  safeRevalidate("/account");
  safeRevalidate("/gallery");
  return {
    ok: true,
    message:
      hidden > 0
        ? `اجازه پس گرفته شد و ${toFa(hidden)} عکس از سایت برداشته شد.`
        : "اجازه‌ی انتشار عکس پس گرفته شد.",
  };
}
