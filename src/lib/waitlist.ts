import "server-only";
import { prisma } from "./prisma";

export type WaitlistRow = {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  serviceId: string;
  serviceTitle: string;
  fromDate: Date;
  toDate: Date;
  note: string | null;
  status: "WAITING" | "NOTIFIED" | "BOOKED" | "CANCELLED";
  notifiedAt: Date | null;
  createdAt: Date;
  /** بازه‌ی مورد نظر مشتری گذشته است */
  isStale: boolean;
};

const shape = {
  customer: { select: { firstName: true, lastName: true, phone: true } },
  service: { select: { title: true } },
} as const;

type Raw = Awaited<ReturnType<typeof prisma.waitlistEntry.findMany<{ include: typeof shape }>>>[number];

function toRow(entry: Raw, now: Date): WaitlistRow {
  return {
    id: entry.id,
    customerId: entry.customerId,
    customerName: `${entry.customer.firstName} ${entry.customer.lastName}`,
    phone: entry.customer.phone,
    serviceId: entry.serviceId,
    serviceTitle: entry.service.title,
    fromDate: entry.fromDate,
    toDate: entry.toDate,
    note: entry.note,
    status: entry.status,
    notifiedAt: entry.notifiedAt,
    createdAt: entry.createdAt,
    isStale: entry.toDate < now,
  };
}

/** همه‌ی درخواست‌های باز — قدیمی‌ترها اول، چون بیشتر منتظر مانده‌اند */
export async function listWaitlist(includeClosed = false): Promise<WaitlistRow[]> {
  const now = new Date();
  const entries = await prisma.waitlistEntry.findMany({
    where: includeClosed ? {} : { status: { in: ["WAITING", "NOTIFIED"] } },
    include: shape,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 200,
  });
  return entries.map((e) => toRow(e, now));
}

/**
 * وقتی نوبتی لغو می‌شود، چه کسانی منتظر همان خدمت در همان بازه‌اند؟
 * برای پیشنهاد به منشی استفاده می‌شود.
 */
export async function matchesForSlot(serviceId: string, startsAt: Date): Promise<WaitlistRow[]> {
  const now = new Date();
  const entries = await prisma.waitlistEntry.findMany({
    where: {
      serviceId,
      status: "WAITING",
      fromDate: { lte: startsAt },
      toDate: { gte: startsAt },
    },
    include: shape,
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  return entries.map((e) => toRow(e, now));
}

export const WAITLIST_STATUS_META: Record<
  WaitlistRow["status"],
  { label: string; tone: "amber" | "plum" | "green" | "neutral" }
> = {
  WAITING: { label: "در انتظار", tone: "amber" },
  NOTIFIED: { label: "خبر داده شد", tone: "plum" },
  BOOKED: { label: "نوبت گرفت", tone: "green" },
  CANCELLED: { label: "منصرف شد", tone: "neutral" },
};
