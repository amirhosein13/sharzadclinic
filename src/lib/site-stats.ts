import "server-only";
import { prisma } from "./prisma";
import type { ReportRange } from "./reports";
import { EVENTS } from "./events";

/**
 * آمار سایت — همان چیزی که گوگل آنالیتیکس نمی‌تواند بگوید.
 *
 * گوگل می‌گوید چند نفر صفحه‌ی بوتاکس را دیدند. ما می‌توانیم بگوییم از آن‌ها
 * چند نفر واقعاً نوبت گرفتند — چون هم بازدید را داریم هم رزرو را. عددِ
 * دومی است که به مدیر می‌گوید کدام صفحه باید بازنویسی شود.
 *
 * هیچ چیزِ شناسایی‌کننده‌ای ثبت نمی‌شود: نه IP، نه کوکی، نه شناسه.
 */

export { EVENTS, type EventKind } from "./events";

const VALID = new Set<string>(Object.values(EVENTS));

/**
 * ثبت یک رویداد. عمداً هیچ‌وقت خطا نمی‌دهد — آمار نباید جلوی کار سایت را
 * بگیرد. اگر جدولش هم نبود، بی‌سروصدا رد می‌شود.
 */
export async function trackEvent(kind: string, serviceSlug?: string | null): Promise<void> {
  if (!VALID.has(kind)) return;
  await prisma.siteEvent
    .create({ data: { kind, serviceSlug: serviceSlug?.slice(0, 80) || null } })
    .catch(() => undefined);
}

export type ServiceFunnelRow = {
  slug: string;
  title: string;
  views: number;
  bookings: number;
  /** درصد بازدیدهایی که به رزرو رسیدند */
  conversion: number;
};

export type BookingFunnel = {
  started: number;
  pickedService: number;
  pickedTime: number;
  finished: number;
  /** بیشترین ریزش کجاست */
  biggestDropLabel: string | null;
  biggestDropPercent: number;
};

export type SiteStats = {
  totalViews: number;
  byService: ServiceFunnelRow[];
  funnel: BookingFunnel;
  /** آیا اصلاً داده‌ای جمع شده */
  hasData: boolean;
};

export async function buildSiteStats(range: ReportRange): Promise<SiteStats> {
  const where = { createdAt: { gte: range.from, lte: range.to } };

  const [views, funnelCounts, services, bookings] = await Promise.all([
    prisma.siteEvent.groupBy({
      by: ["serviceSlug"],
      where: { ...where, kind: EVENTS.serviceView },
      _count: { _all: true },
    }),
    prisma.siteEvent.groupBy({
      by: ["kind"],
      where,
      _count: { _all: true },
    }),
    prisma.service.findMany({ select: { slug: true, title: true } }),
    prisma.appointment.groupBy({
      by: ["serviceId"],
      where: { createdAt: { gte: range.from, lte: range.to }, source: { not: "admin" } },
      _count: { _all: true },
    }),
  ]);

  const titleOf = new Map(services.map((s) => [s.slug, s.title]));
  const idToSlug = new Map<string, string>();
  const withIds = await prisma.service.findMany({ select: { id: true, slug: true } });
  for (const s of withIds) idToSlug.set(s.id, s.slug);

  const bookingsBySlug = new Map<string, number>();
  for (const row of bookings) {
    const slug = idToSlug.get(row.serviceId);
    if (slug) bookingsBySlug.set(slug, (bookingsBySlug.get(slug) ?? 0) + row._count._all);
  }

  const byService: ServiceFunnelRow[] = views
    .filter((v) => !!v.serviceSlug)
    .map((v) => {
      const slug = v.serviceSlug!;
      const viewCount = v._count._all;
      const bookingCount = bookingsBySlug.get(slug) ?? 0;
      return {
        slug,
        title: titleOf.get(slug) ?? slug,
        views: viewCount,
        bookings: bookingCount,
        conversion: viewCount > 0 ? Math.round((bookingCount / viewCount) * 100) : 0,
      };
    })
    .sort((a, b) => b.views - a.views);

  const countOf = (kind: string) =>
    funnelCounts.find((f) => f.kind === kind)?._count._all ?? 0;

  const started = countOf(EVENTS.bookingStart);
  const pickedService = countOf(EVENTS.bookingService);
  const pickedTime = countOf(EVENTS.bookingTime);
  const finished = countOf(EVENTS.bookingDone);

  // بزرگ‌ترین ریزش بین مراحل — همان‌جا باید درست شود
  const steps: { label: string; from: number; to: number }[] = [
    { label: "از باز کردن صفحه‌ی رزرو تا انتخاب خدمت", from: started, to: pickedService },
    { label: "از انتخاب خدمت تا انتخاب ساعت", from: pickedService, to: pickedTime },
    { label: "از انتخاب ساعت تا ثبت نهایی", from: pickedTime, to: finished },
  ];

  let biggestDropLabel: string | null = null;
  let biggestDropPercent = 0;
  for (const step of steps) {
    if (step.from < 5) continue; // با عدد کوچک، درصد بی‌معنی است
    const drop = Math.round(((step.from - step.to) / step.from) * 100);
    if (drop > biggestDropPercent) {
      biggestDropPercent = drop;
      biggestDropLabel = step.label;
    }
  }

  const totalViews = views.reduce((sum, v) => sum + v._count._all, 0);

  return {
    totalViews,
    byService,
    funnel: { started, pickedService, pickedTime, finished, biggestDropLabel, biggestDropPercent },
    hasData: totalViews > 0 || started > 0,
  };
}

/** پاک‌کردن رویدادهای قدیمی — آمار قرار نیست تا ابد جا بگیرد */
export async function pruneEvents(keepDays = 400): Promise<number> {
  const result = await prisma.siteEvent.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - keepDays * 86_400_000) } },
  });
  return result.count;
}
