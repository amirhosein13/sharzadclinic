import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { sendSms } from "./notifications";
import { toFa } from "./utils";
import type { Prisma } from "@prisma/client";

/**
 * پیامک گروهی.
 *
 * سه قاعده‌ی سفت‌وسخت دارد، چون پیامک انبوهِ بی‌ملاحظه هم مشتری را فراری
 * می‌دهد هم ممکن است خط پنل پیامک را ببندد:
 *   ۱. هرکس «پیامک تبلیغاتی نمی‌خواهم» زده باشد، هیچ‌وقت در فهرست نمی‌آید.
 *   ۲. سقف روزانه دارد.
 *   ۳. گیرنده‌ها هنگام شروع قفل می‌شوند؛ ادامه‌ی یک ارسال نیمه‌کاره کسی را
 *      دوباره پیامک نمی‌کند.
 */

/** بیشترین پیامک گروهی در یک شبانه‌روز */
export const DAILY_LIMIT = 300;
/** هر بار چند تا فرستاده شود */
export const BATCH_SIZE = 25;
const TEMPLATE = "campaign";

export type CampaignFilter = {
  serviceId?: string | null;
  /** کسانی که این‌قدر ماه است نیامده‌اند */
  inactiveMonths?: number | null;
  /** فقط کسانی که حداقل یک جلسه‌ی انجام‌شده دارند */
  onlyWithVisits?: boolean;
};

/** شرط انتخاب گروه — یک جا تعریف می‌شود تا پیش‌نمایش و ارسال حتماً یکی باشند */
export function audienceWhere(filter: CampaignFilter): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [
    { isBlocked: false },
    // خواسته‌ی مشتری بر همه‌چیز مقدم است
    { smsOptOut: false },
  ];

  if (filter.serviceId) {
    and.push({ appointments: { some: { serviceId: filter.serviceId, status: "DONE" } } });
  } else if (filter.onlyWithVisits) {
    and.push({ appointments: { some: { status: "DONE" } } });
  }

  if (filter.inactiveMonths && filter.inactiveMonths > 0) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - filter.inactiveMonths);
    // هیچ نوبتی — گذشته یا آینده — بعد از این تاریخ نداشته باشد
    and.push({ appointments: { none: { startsAt: { gte: cutoff } } } });
  }

  return { AND: and };
}

export async function audienceCount(filter: CampaignFilter): Promise<number> {
  return prisma.customer.count({ where: audienceWhere(filter) });
}

/** چند پیامک گروهی امروز رفته است */
export async function sentToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.notificationLog.count({
    where: { template: TEMPLATE, status: "sent", createdAt: { gte: start } },
  });
}

export type StartResult =
  | { ok: true; campaignId: string; queued: number }
  | { ok: false; message: string };

/**
 * گیرنده‌ها را قفل می‌کند و کمپین را به حالت «در حال ارسال» می‌برد.
 * خودِ ارسال در `sendBatch` انجام می‌شود تا درخواست وب طولانی نشود.
 */
export async function startCampaign(campaignId: string): Promise<StartResult> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, message: "کمپین پیدا نشد." };
  if (campaign.status !== "DRAFT") {
    return { ok: false, message: "این کمپین قبلاً شروع شده است." };
  }

  const audience = await prisma.customer.findMany({
    where: audienceWhere({
      serviceId: campaign.serviceId,
      inactiveMonths: campaign.inactiveMonths,
      onlyWithVisits: campaign.onlyWithVisits,
    }),
    select: { id: true },
  });

  if (audience.length === 0) {
    return { ok: false, message: "با این فیلترها هیچ‌کس پیدا نشد." };
  }

  await prisma.campaignRecipient.createMany({
    data: audience.map((c) => ({ campaignId, customerId: c.id })),
    skipDuplicates: true,
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING", total: audience.length, startedAt: new Date() },
  });

  return { ok: true, campaignId, queued: audience.length };
}

export type BatchResult = {
  sent: number;
  failed: number;
  remaining: number;
  stopped?: string;
};

/**
 * یک دسته از پیامک‌های در صف را می‌فرستد.
 * هم از پنل صدا زده می‌شود، هم از `npm run campaign` برای بقیه‌اش.
 */
export async function sendBatch(campaignId: string, limit = BATCH_SIZE): Promise<BatchResult> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "SENDING") {
    return { sent: 0, failed: 0, remaining: 0, stopped: "کمپین در حال ارسال نیست." };
  }

  const alreadyToday = await sentToday();
  const room = DAILY_LIMIT - alreadyToday;
  if (room <= 0) {
    return {
      sent: 0,
      failed: 0,
      remaining: await queuedCount(campaignId),
      stopped: `سقف روزانه (${toFa(DAILY_LIMIT)} پیامک) پر شده است. فردا خودکار ادامه پیدا می‌کند.`,
    };
  }

  const batch = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "queued" },
    take: Math.min(limit, room),
    include: { customer: { select: { firstName: true, phone: true, smsOptOut: true } } },
  });

  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    // ممکن است بین قفل‌شدن فهرست و رسیدن نوبتش، انصراف داده باشد
    if (row.customer.smsOptOut) {
      await prisma.campaignRecipient.update({
        where: { id: row.id },
        data: { status: "failed", error: "انصراف از پیامک تبلیغاتی" },
      });
      failed++;
      continue;
    }

    const result = await sendSms({
      to: row.customer.phone,
      template: TEMPLATE,
      message: campaign.message,
    }).catch(() => ({ ok: false, error: "خطای ناشناخته" }));

    if (result.ok) {
      await prisma.campaignRecipient.update({
        where: { id: row.id },
        data: { status: "sent", sentAt: new Date() },
      });
      sent++;
    } else {
      await prisma.campaignRecipient.update({
        where: { id: row.id },
        data: { status: "failed", error: ("error" in result && result.error) || "ارسال ناموفق" },
      });
      failed++;
    }
  }

  const remaining = await queuedCount(campaignId);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sent: { increment: sent },
      failed: { increment: failed },
      ...(remaining === 0 ? { status: "DONE" as const, finishedAt: new Date() } : {}),
    },
  });

  return { sent, failed, remaining };
}

export async function queuedCount(campaignId: string): Promise<number> {
  return prisma.campaignRecipient.count({ where: { campaignId, status: "queued" } });
}

/** کمپین‌هایی که هنوز پیامک در صف دارند — برای اجرای شبانه */
export async function pendingCampaigns(): Promise<{ id: string; title: string }[]> {
  return prisma.campaign.findMany({
    where: { status: "SENDING" },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * متن کامل پیامک، با یک خط راهنمای انصراف.
 * پیامک تبلیغاتیِ بدون راه انصراف، هم بی‌ادبی است هم دردسر قانونی.
 */
export async function decorateMessage(body: string): Promise<string> {
  const settings = await getSettings();
  return `${body.trim()}\n${settings.clinicName}\nانصراف از پیامک: از «حساب من» در سایت`;
}
