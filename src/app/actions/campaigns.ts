"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import {
  audienceCount,
  decorateMessage,
  sendBatch,
  startCampaign,
  type CampaignFilter,
} from "@/lib/campaigns";
import { getCustomerSession } from "@/lib/customer-auth";
import { safeRevalidate } from "@/lib/revalidate";
import { fieldErrors } from "@/lib/validators";
import { toEn, toFa } from "@/lib/utils";
import type { FormResult } from "./content";

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

const campaignSchema = z.object({
  title: z.string().trim().min(3, "یک نام برای این ارسال بنویسید").max(80),
  message: z
    .string()
    .trim()
    .min(10, "متن پیامک خیلی کوتاه است")
    .max(400, "متن پیامک طولانی است — هر ۷۰ حرف یک پیامک حساب می‌شود"),
  serviceId: z.string().trim().optional(),
  inactiveMonths: z.string().trim().optional(),
  onlyWithVisits: z.coerce.boolean().optional(),
});

function filterOf(v: z.infer<typeof campaignSchema>): CampaignFilter {
  const months = Number(toEn(v.inactiveMonths ?? ""));
  return {
    serviceId: v.serviceId || null,
    inactiveMonths: Number.isFinite(months) && months > 0 ? Math.round(months) : null,
    onlyWithVisits: !!v.onlyWithVisits,
  };
}

async function guard<T>(fn: () => Promise<T>): Promise<T | FormResult> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return { ok: false, message: "برای این کار باید وارد شوید." };
    if (message === "FORBIDDEN") return { ok: false, message: "برای این کار دسترسی ندارید." };
    console.error(error);
    return { ok: false, message: "انجام نشد. دوباره تلاش کنید." };
  }
}

/** پیش‌نمایش: با این فیلترها چند نفر پیامک می‌گیرند */
export async function previewAudience(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    await requireRole("ADMIN", "MANAGER");
    const parsed = campaignSchema.partial({ title: true, message: true }).safeParse({
      title: text(formData.get("title")) || "پیش‌نمایش",
      message: text(formData.get("message")) || "پیش‌نمایش پیش‌نمایش",
      serviceId: text(formData.get("serviceId")),
      inactiveMonths: text(formData.get("inactiveMonths")),
      onlyWithVisits: formData.get("onlyWithVisits") === "on",
    });
    if (!parsed.success) return { ok: false, message: "فیلترها را بررسی کنید." };

    const count = await audienceCount(filterOf(parsed.data as z.infer<typeof campaignSchema>));
    return {
      ok: true,
      message:
        count === 0
          ? "با این فیلترها هیچ‌کس پیدا نشد."
          : `${toFa(count)} نفر پیامک می‌گیرند.`,
    };
  }) as Promise<FormResult>;
}

/** ساخت کمپین به‌صورت پیش‌نویس — هنوز چیزی فرستاده نمی‌شود */
export async function createCampaign(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const user = await requireRole("ADMIN", "MANAGER");
    const parsed = campaignSchema.safeParse({
      title: text(formData.get("title")),
      message: text(formData.get("message")),
      serviceId: text(formData.get("serviceId")),
      inactiveMonths: text(formData.get("inactiveMonths")),
      onlyWithVisits: formData.get("onlyWithVisits") === "on",
    });
    if (!parsed.success) {
      return { ok: false, message: "ورودی‌ها را بررسی کنید.", errors: fieldErrors(parsed.error) };
    }

    const filter = filterOf(parsed.data);
    const count = await audienceCount(filter);
    if (count === 0) return { ok: false, message: "با این فیلترها هیچ‌کس پیدا نشد." };

    const campaign = await prisma.campaign.create({
      data: {
        title: parsed.data.title,
        message: await decorateMessage(parsed.data.message),
        serviceId: filter.serviceId,
        inactiveMonths: filter.inactiveMonths,
        onlyWithVisits: !!filter.onlyWithVisits,
        createdById: user.id,
      },
    });

    await logAction({
      userId: user.id,
      action: "campaign.create",
      entity: "Campaign",
      entityId: campaign.id,
      detail: `${parsed.data.title} — ${count} گیرنده`,
    });

    safeRevalidate("/admin/campaigns");
    return {
      ok: true,
      message: `پیش‌نویس ساخته شد. ${toFa(count)} نفر در فهرست‌اند — متن را یک بار بخوانید و بعد «شروع ارسال» را بزنید.`,
    };
  }) as Promise<FormResult>;
}

/** شروع ارسال — گیرنده‌ها قفل می‌شوند و اولین دسته می‌رود */
export async function launchCampaign(id: string): Promise<FormResult> {
  return guard(async () => {
    const user = await requireRole("ADMIN", "MANAGER");
    const started = await startCampaign(id);
    if (!started.ok) return { ok: false, message: started.message };

    const batch = await sendBatch(id);

    await logAction({
      userId: user.id,
      action: "campaign.send",
      entity: "Campaign",
      entityId: id,
      detail: `${started.queued} گیرنده`,
    });

    safeRevalidate("/admin/campaigns");
    return {
      ok: true,
      message: batch.stopped
        ? batch.stopped
        : `${toFa(batch.sent)} پیامک رفت. ${toFa(batch.remaining)} تا مانده — بقیه خودکار فرستاده می‌شود.`,
    };
  }) as Promise<FormResult>;
}

/** ادامه‌ی دستی، برای وقتی مدیر نمی‌خواهد تا شب صبر کند */
export async function continueCampaign(id: string): Promise<FormResult> {
  return guard(async () => {
    await requireRole("ADMIN", "MANAGER");
    const batch = await sendBatch(id);
    safeRevalidate("/admin/campaigns");
    return {
      ok: true,
      message: batch.stopped
        ? batch.stopped
        : `${toFa(batch.sent)} پیامک رفت. ${toFa(batch.remaining)} تا مانده.`,
    };
  }) as Promise<FormResult>;
}

export async function cancelCampaign(id: string): Promise<FormResult> {
  return guard(async () => {
    const user = await requireRole("ADMIN", "MANAGER");
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return { ok: false, message: "کمپین پیدا نشد." };
    if (campaign.status === "DONE") {
      return { ok: false, message: "این ارسال تمام شده و متوقف‌کردنی نیست." };
    }

    await prisma.campaign.update({
      where: { id },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
    await logAction({
      userId: user.id,
      action: "campaign.cancel",
      entity: "Campaign",
      entityId: id,
      detail: campaign.title,
    });

    safeRevalidate("/admin/campaigns");
    return { ok: true, message: "ارسال متوقف شد. پیامک‌های نرفته دیگر فرستاده نمی‌شوند." };
  }) as Promise<FormResult>;
}

/** خودِ مشتری از پنلش پیامک تبلیغاتی را خاموش/روشن می‌کند */
export async function toggleSmsOptOut(optOut: boolean): Promise<FormResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, message: "برای این کار باید وارد حسابتان شوید." };

  await prisma.customer.update({
    where: { id: session.id },
    data: { smsOptOut: optOut },
  });

  safeRevalidate("/account");
  return {
    ok: true,
    message: optOut
      ? "دیگر پیامک تبلیغاتی برایتان فرستاده نمی‌شود. یادآوری نوبت و کد ورود همچنان می‌آید."
      : "پیامک‌های اطلاع‌رسانی دوباره روشن شد.",
  };
}
