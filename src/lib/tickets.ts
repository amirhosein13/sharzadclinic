import "server-only";
import type { TicketStatus } from "@prisma/client";
import { prisma } from "./prisma";

export const TICKET_CATEGORIES = [
  { key: "appointment", label: "نوبت و زمان مراجعه" },
  { key: "treatment", label: "سؤال درباره‌ی درمان" },
  { key: "aftercare", label: "مراقبت بعد از درمان" },
  { key: "payment", label: "پرداخت و مالی" },
  { key: "complaint", label: "شکایت و نارضایتی" },
  { key: "other", label: "سایر" },
] as const;

const CATEGORY_LABELS = new Map(TICKET_CATEGORIES.map((c) => [c.key, c.label]));

export function ticketCategoryLabel(key: string): string {
  return CATEGORY_LABELS.get(key as (typeof TICKET_CATEGORIES)[number]["key"]) ?? "سایر";
}

export function isTicketCategory(key: string): boolean {
  return CATEGORY_LABELS.has(key as (typeof TICKET_CATEGORIES)[number]["key"]);
}

export const TICKET_STATUS_META: Record<
  TicketStatus,
  { label: string; tone: "amber" | "green" | "neutral" }
> = {
  OPEN: { label: "منتظر پاسخ ما", tone: "amber" },
  ANSWERED: { label: "پاسخ داده شد", tone: "green" },
  CLOSED: { label: "بسته شده", tone: "neutral" },
};

/** شکایت‌ها باید زودتر از بقیه دیده شوند */
export function isUrgent(category: string, status: TicketStatus): boolean {
  return category === "complaint" && status === "OPEN";
}

export async function openTicketCount(): Promise<number> {
  return prisma.supportTicket.count({ where: { unreadByStaff: true, status: { not: "CLOSED" } } });
}

/** تیکت‌های باز مشتری که هنوز پاسخ کارکنان را ندیده است */
export async function customerUnreadCount(customerId: string): Promise<number> {
  return prisma.supportTicket.count({ where: { customerId, unreadByCustomer: true } });
}
