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
export async function generateFollowUps(): Promise<{ noShow: number; nextSession: number }> {
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
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - nextSessionDays);

  // آخرین جلسه‌ی هر مشتری که پیش از cutoff بوده
  const candidates = await prisma.appointment.findMany({
    where: { status: "DONE", startsAt: { lt: cutoff } },
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

  return { noShow, nextSession };
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
