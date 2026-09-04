"use server";

import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { fieldErrors, ticketReplySchema, ticketSchema } from "@/lib/validators";
import { isTicketCategory } from "@/lib/tickets";
import { notifyTicketReply } from "@/lib/notifications";
import { safeRevalidate } from "@/lib/revalidate";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/* ── سمت مشتری ──────────────────────────────────────────────── */

export async function openTicket(formData: FormData): Promise<FormResult> {
  const session = await getCustomerSession();
  if (!session) return FAIL("برای ارسال پیام باید وارد حساب خود شوید.");

  const parsed = ticketSchema.safeParse({
    subject: text(formData.get("subject")),
    category: text(formData.get("category")) || "other",
    body: text(formData.get("body")),
  });
  if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

  const v = parsed.data;
  try {
    // جلوگیری از باز کردن ده‌ها تیکت پشت سر هم
    const openCount = await prisma.supportTicket.count({
      where: { customerId: session.id, status: { not: "CLOSED" } },
    });
    if (openCount >= 5) {
      return FAIL("شما ۵ گفت‌وگوی باز دارید. لطفاً در همان‌ها ادامه دهید.");
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        customerId: session.id,
        subject: v.subject,
        category: isTicketCategory(v.category) ? v.category : "other",
        messages: { create: { sender: "CUSTOMER", body: v.body } },
      },
    });

    safeRevalidate("/account", "/admin/tickets");
    return OK(`پیام شما ثبت شد. به‌زودی پاسخ می‌دهیم. (شماره پیگیری ${ticket.id.slice(-6)})`);
  } catch (error) {
    console.error(error);
    return FAIL("ثبت پیام با خطا مواجه شد. دوباره تلاش کنید.");
  }
}

export async function replyAsCustomer(formData: FormData): Promise<FormResult> {
  const session = await getCustomerSession();
  if (!session) return FAIL("برای ارسال پیام باید وارد حساب خود شوید.");

  const parsed = ticketReplySchema.safeParse({
    ticketId: text(formData.get("ticketId")),
    body: text(formData.get("body")),
  });
  if (!parsed.success) return FAIL("متن پاسخ را بنویسید.", fieldErrors(parsed.error));

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: parsed.data.ticketId },
      select: { id: true, customerId: true, status: true },
    });
    // هر مشتری فقط در گفت‌وگوی خودش می‌نویسد
    if (!ticket || ticket.customerId !== session.id) return FAIL("این گفت‌وگو پیدا نشد.");
    if (ticket.status === "CLOSED") {
      return FAIL("این گفت‌وگو بسته شده است. لطفاً پیام تازه‌ای باز کنید.");
    }

    await prisma.$transaction([
      prisma.ticketMessage.create({
        data: { ticketId: ticket.id, sender: "CUSTOMER", body: parsed.data.body },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "OPEN", lastSender: "CUSTOMER", unreadByStaff: true },
      }),
    ]);

    safeRevalidate("/account", "/admin/tickets");
    return OK("پاسخ شما ثبت شد.");
  } catch (error) {
    console.error(error);
    return FAIL("ارسال پاسخ با خطا مواجه شد.");
  }
}

/** وقتی مشتری گفت‌وگو را باز می‌کند، نشانِ «خوانده‌نشده» برداشته می‌شود */
export async function markTicketSeenByCustomer(ticketId: string): Promise<void> {
  const session = await getCustomerSession();
  if (!session) return;
  await prisma.supportTicket
    .updateMany({
      where: { id: ticketId, customerId: session.id },
      data: { unreadByCustomer: false },
    })
    .catch(() => undefined);
}

/* ── سمت کلینیک ─────────────────────────────────────────────── */

async function guardStaff<T>(fn: () => Promise<T>) {
  try {
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("برای پاسخ به پیام‌ها دسترسی ندارید.");
    console.error(error);
    return FAIL("انجام این کار با خطا مواجه شد.");
  }
}

export async function replyAsStaff(formData: FormData): Promise<FormResult> {
  return guardStaff(async () => {
    const user = await requireRole("ADMIN", "MANAGER", "RECEPTION");
    const parsed = ticketReplySchema.safeParse({
      ticketId: text(formData.get("ticketId")),
      body: text(formData.get("body")),
    });
    if (!parsed.success) return FAIL("متن پاسخ را بنویسید.", fieldErrors(parsed.error));

    const closeAfter = formData.get("closeAfter") === "on";

    const ticket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: parsed.data.ticketId },
      include: { customer: { select: { firstName: true, lastName: true, phone: true } } },
    });

    await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          sender: "STAFF",
          userId: user.id,
          body: parsed.data.body,
        },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: closeAfter ? "CLOSED" : "ANSWERED",
          lastSender: "STAFF",
          unreadByStaff: false,
          unreadByCustomer: true,
          closedAt: closeAfter ? new Date() : null,
        },
      }),
    ]);

    // مشتری باید بداند جواب آمده، وگرنه هیچ‌وقت برنمی‌گردد ببیند
    await notifyTicketReply({
      phone: ticket.customer.phone,
      customerName: `${ticket.customer.firstName} ${ticket.customer.lastName}`,
      subject: ticket.subject,
    }).catch(() => undefined);

    await logAction({ userId: user.id, action: "ticket.reply", entity: "SupportTicket", entityId: ticket.id });
    safeRevalidate("/admin/tickets", "/account");
    return OK(closeAfter ? "پاسخ ارسال و گفت‌وگو بسته شد." : "پاسخ ارسال شد.");
  }) as Promise<FormResult>;
}

export async function setTicketStatus(
  id: string,
  status: "OPEN" | "CLOSED",
): Promise<FormResult> {
  return guardStaff(async () => {
    await prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        closedAt: status === "CLOSED" ? new Date() : null,
        unreadByStaff: false,
      },
    });
    safeRevalidate("/admin/tickets", "/account");
    return OK(status === "CLOSED" ? "گفت‌وگو بسته شد." : "گفت‌وگو دوباره باز شد.");
  }) as Promise<FormResult>;
}

/** باز کردن تیکت توسط کارکنان، از پرونده‌ی مشتری */
export async function openTicketForCustomer(formData: FormData): Promise<FormResult> {
  return guardStaff(async () => {
    const user = await requireRole("ADMIN", "MANAGER", "RECEPTION");
    const customerId = text(formData.get("customerId"));
    const parsed = ticketSchema.safeParse({
      subject: text(formData.get("subject")),
      category: text(formData.get("category")) || "other",
      body: text(formData.get("body")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { firstName: true, lastName: true, phone: true },
    });

    await prisma.supportTicket.create({
      data: {
        customerId,
        subject: v.subject,
        category: isTicketCategory(v.category) ? v.category : "other",
        status: "ANSWERED",
        lastSender: "STAFF",
        unreadByStaff: false,
        unreadByCustomer: true,
        messages: { create: { sender: "STAFF", userId: user.id, body: v.body } },
      },
    });

    await notifyTicketReply({
      phone: customer.phone,
      customerName: `${customer.firstName} ${customer.lastName}`,
      subject: v.subject,
    }).catch(() => undefined);

    safeRevalidate("/admin/tickets", `/admin/customers/${customerId}`, "/account");
    return OK("پیام برای مشتری ارسال شد.");
  }) as Promise<FormResult>;
}
