import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { toFa } from "./utils";
import type { FollowUpKind } from "@prisma/client";

/**
 * موتور پیگیری مراجعین.
 *
 * سه دسته کار برای منشی می‌سازد:
 *  ۱. کسانی که نوبتشان گذشته و وضعیتش مشخص نشده (نیامد؟ انجام شد؟)
 *  ۲. کسانی که وقت جلسه‌ی بعدی دوره‌شان رسیده و هنوز نوبت نگرفته‌اند
 *  ۳. یادآوری‌های دستی که خود منشی ثبت کرده
 *
 * دسته‌های ۱ و ۲ خودکار ساخته می‌شوند و تکراری ثبت نمی‌شوند.
 */

/** پس از چند روز از آخرین جلسه، پیگیری جلسه‌ی بعدی ساخته شود */
const DEFAULT_NEXT_SESSION_DAYS = 28;
/** حداکثر روزهای گذشته که برای نوبت‌های بلاتکلیف عقب می‌رویم */
const STALE_LOOKBACK_DAYS = 14;
/**
 * پنجره‌ی بازگردانی: فقط کسانی که «تازه» از مرز بازگردانی گذشته‌اند.
 *
 * بدون این کران، کارتابل بازگردانی هر ۲۶۷۰ پرونده‌ی منتقل‌شده را در خود
 * می‌ریزد — فهرستی که هیچ منشی‌ای نمی‌تواند با آن کار کند. کسی که دو
 * سال است نیامده با تماس تلفنی برنمی‌گردد؛ او مخاطبِ «پیامک گروهی
 * هدفمند» است، نه کارتابل روزانه.
 */
const WIN_BACK_WINDOW_MONTHS = 6;

export type FollowUpItem = {
  id: string;
  kind: FollowUpKind;
  dueAt: Date;
  reason: string | null;
  note: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  appointment: {
    id: string;
    code: string;
    startsAt: Date;
    serviceTitle: string;
  } | null;
  /** روزهای گذشته از موعد؛ منفی یعنی هنوز نرسیده */
  overdueDays: number;
};

/**
 * پیگیری‌های خودکار را می‌سازد. idempotent است: اگر برای همان نوبت یا
 * همان مشتری پیگیری باز وجود داشته باشد، دوباره ساخته نمی‌شود.
 */
export async function generateFollowUps(): Promise<{
  noShow: number;
  nextSession: number;
  postCare: number;
  winBack: number;
  /** پیگیری‌های قدیمی که دیگر معنی ندارند و خودکار بسته شدند */
  retired: number;
}> {
  const settings = await getSettings();
  const nextSessionDays = Number(settings.followUpAfterDays) || DEFAULT_NEXT_SESSION_DAYS;

  const now = new Date();
  const lookback = new Date(now);
  lookback.setDate(lookback.getDate() - STALE_LOOKBACK_DAYS);

  // ─── ۱. نوبت‌هایی که گذشته‌اند و هنوز بلاتکلیف‌اند ───
  const stale = await prisma.appointment.findMany({
    where: {
      endsAt: { lt: now, gte: lookback },
      status: { in: ["PENDING", "CONFIRMED"] },
      followUps: { none: { status: "OPEN" } },
    },
    include: { customer: { select: { id: true } }, service: { select: { title: true } } },
    take: 200,
  });

  let noShow = 0;
  for (const appt of stale) {
    await prisma.followUp
      .create({
        data: {
          customerId: appt.customerId,
          appointmentId: appt.id,
          kind: "NO_SHOW",
          dueAt: appt.endsAt,
          reason: `نوبت ${appt.service.title} گذشته و وضعیتش ثبت نشده`,
        },
      })
      .then(() => noShow++)
      .catch(() => undefined);
  }

  // ─── ۲. مشتریانی که وقت جلسه‌ی بعدی دوره‌شان رسیده ───
  //
  // این بخش یک کرانِ بالا هم لازم دارد و نداشتنش یک باگ واقعی ساخت:
  // بعد از مهاجرتِ سوابق قدیمی، هزاران نوبتِ انجام‌شده‌ی سال‌های گذشته
  // وارد دیتابیس شد و همه‌شان «وقت جلسه‌ی بعد» شدند. کارتابل منشی پر
  // شد از کسانی که آخرین جلسه‌شان یک سال و نیم پیش بوده — و تماس با
  // آن‌ها به‌عنوان «جلسه‌ی بعدی دوره» بی‌معنی و خجالت‌آور است.
  //
  // مرز درست همان مرز بازگردانی است: کسی که بیش از winBackMonths
  // نیامده، مشتریِ «وسط دوره» نیست؛ مشتریِ ازدست‌رفته است و بخش ۴
  // سراغش می‌رود. عارضه‌ی دوم همین بود: چون این بخش اول اجرا می‌شود و
  // برای همه پیگیری باز می‌ساخت، شرط «پیگیری باز نداشته باشد» در بخش
  // ۴ همیشه رد می‌شد و بازگردانی هیچ‌وقت کار نمی‌کرد.
  const winBackMonths = Number(settings.winBackAfterMonths) || 6;
  const winBackCutoff = new Date(now);
  winBackCutoff.setMonth(winBackCutoff.getMonth() - winBackMonths);

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - nextSessionDays);

  // پیگیری‌هایی که قبلاً (با منطق بدونِ کرانِ بالا) ساخته شده‌اند و
  // دیگر معنی ندارند، خودشان بسته می‌شوند. بدون این، آن انبوهِ موارد
  // قدیمی تا ابد در کارتابل منشی می‌ماند و باید دستی بایگانی شود.
  const retired = await prisma.followUp.updateMany({
    where: {
      status: "OPEN",
      kind: "NEXT_SESSION",
      appointment: { startsAt: { lt: winBackCutoff } },
    },
    data: {
      status: "DISMISSED",
      handledAt: now,
      outcome: "خودکار بسته شد: آخرین جلسه برای «جلسه‌ی بعدی دوره» خیلی قدیمی است",
    },
  });

  // آخرین جلسه‌ی هر مشتری که پیش از cutoff بوده
  const candidates = await prisma.appointment.findMany({
    // lt: cutoff  → از آخرین جلسه‌اش به‌اندازه‌ی یک دوره گذشته
    // gte: winBackCutoff → ولی آن‌قدر قدیمی نیست که مشتریِ ازدست‌رفته باشد
    where: { status: "DONE", startsAt: { lt: cutoff, gte: winBackCutoff } },
    include: {
      customer: { select: { id: true, isBlocked: true } },
      service: { select: { title: true, sessionsNeeded: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 500,
  });

  const seen = new Set<string>();
  let nextSession = 0;

  for (const appt of candidates) {
    if (seen.has(appt.customerId) || appt.customer.isBlocked) continue;
    seen.add(appt.customerId);

    // اگر نوبت آینده دارد یا پیگیری باز دارد، کاری لازم نیست
    const [future, open] = await Promise.all([
      prisma.appointment.count({
        where: {
          customerId: appt.customerId,
          startsAt: { gte: now },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      }),
      prisma.followUp.count({ where: { customerId: appt.customerId, status: "OPEN" } }),
    ]);
    if (future > 0 || open > 0) continue;

    // اگر جلسه‌ی جدیدتری بعد از cutoff داشته، هنوز وقتش نرسیده
    const newer = await prisma.appointment.count({
      where: { customerId: appt.customerId, status: "DONE", startsAt: { gte: cutoff } },
    });
    if (newer > 0) continue;

    await prisma.followUp
      .create({
        data: {
          customerId: appt.customerId,
          appointmentId: appt.id,
          kind: "NEXT_SESSION",
          dueAt: now,
          reason: `آخرین جلسه‌ی ${appt.service.title} بیش از ${toFa(nextSessionDays)} روز پیش بوده`,
        },
      })
      .then(() => nextSession++)
      .catch(() => undefined);
  }

  // ─── ۳. پیگیری پس از درمان، بر اساس تنظیم هر خدمت ───
  // خدمت‌هایی مثل تزریق که چند روز بعدش باید حال مشتری پرسیده شود
  const postCareServices = await prisma.service.findMany({
    where: { followUpDays: { gt: 0 } },
    select: { id: true, title: true, followUpDays: true },
  });

  let postCare = 0;
  for (const svc of postCareServices) {
    const due = new Date(now);
    due.setDate(due.getDate() - svc.followUpDays);
    // پنجره‌ی چندروزه، تا اگر یک روز اجرا نشد از قلم نیفتد
    const windowStart = new Date(due);
    windowStart.setDate(windowStart.getDate() - 3);

    const sessions = await prisma.appointment.findMany({
      where: {
        serviceId: svc.id,
        status: "DONE",
        startsAt: { gte: windowStart, lte: due },
        followUps: { none: { kind: "POST_CARE" } },
        customer: { isBlocked: false },
      },
      select: { id: true, customerId: true, startsAt: true },
      take: 200,
    });

    for (const session of sessions) {
      await prisma.followUp
        .create({
          data: {
            customerId: session.customerId,
            appointmentId: session.id,
            kind: "POST_CARE",
            dueAt: now,
            reason: `${toFa(svc.followUpDays)} روز از ${svc.title} گذشته — حالش را بپرسید`,
          },
        })
        .then(() => postCare++)
        .catch(() => undefined);
    }
  }

  // ─── ۴. مشتریانی که خیلی وقت است نیامده‌اند ───
  // winBackMonths و winBackCutoff بالاتر محاسبه شده‌اند، چون بخش ۲ هم
  // به همان مرز نیاز دارد.

  // کرانِ پایینِ پنجره: قدیمی‌تر از این، دیگر کارِ کارتابل نیست
  const winBackFloor = new Date(winBackCutoff);
  winBackFloor.setMonth(winBackFloor.getMonth() - WIN_BACK_WINDOW_MONTHS);

  const dormant = await prisma.customer.findMany({
    where: {
      isBlocked: false,
      appointments: {
        // «تازه» غایب شده: آخرین مراجعه‌اش داخل پنجره است
        some: { status: "DONE", startsAt: { gte: winBackFloor } },
        // و هیچ نوبتی — نه انجام‌شده نه آینده — بعد از مرز نداشته باشد
        none: { startsAt: { gte: winBackCutoff } },
      },
      followUps: { none: { status: "OPEN" } },
    },
    select: { id: true },
    take: 100,
  });

  let winBack = 0;
  for (const customer of dormant) {
    await prisma.followUp
      .create({
        data: {
          customerId: customer.id,
          kind: "CUSTOM",
          dueAt: now,
          reason: `بیش از ${toFa(winBackMonths)} ماه است مراجعه نکرده — برای بازگشت تماس بگیرید`,
        },
      })
      .then(() => winBack++)
      .catch(() => undefined);
  }

  return { noShow, nextSession, postCare, winBack, retired: retired.count };
}

/** فهرست پیگیری‌های باز، مرتب‌شده بر اساس فوریت */
export async function listOpenFollowUps(limit = 100): Promise<FollowUpItem[]> {
  const rows = await prisma.followUp.findMany({
    where: { status: "OPEN" },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      appointment: {
        select: { id: true, code: true, startsAt: true, service: { select: { title: true } } },
      },
    },
    orderBy: [{ dueAt: "asc" }],
    take: limit,
  });

  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    dueAt: row.dueAt,
    reason: row.reason,
    note: row.note,
    customer: {
      id: row.customer.id,
      name: `${row.customer.firstName} ${row.customer.lastName}`,
      phone: row.customer.phone,
    },
    appointment: row.appointment
      ? {
          id: row.appointment.id,
          code: row.appointment.code,
          startsAt: row.appointment.startsAt,
          serviceTitle: row.appointment.service.title,
        }
      : null,
    overdueDays: Math.floor((now - row.dueAt.getTime()) / 86_400_000),
  }));
}

/** نوبت‌های امروز و فردا که هنوز تأیید نشده‌اند و باید تماس گرفته شود */
export async function listUnconfirmed() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 2);
  to.setHours(23, 59, 59, 999);

  return prisma.appointment.findMany({
    where: { status: "PENDING", startsAt: { gte: from, lte: to } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      service: { select: { title: true } },
      staff: { select: { name: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}
