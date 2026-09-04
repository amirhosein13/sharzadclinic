import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { lowStockCount } from "./inventory";
import { listBackups } from "./backup";
import { UNHAPPY_THRESHOLD } from "./feedback";
import { recentFailedLogins } from "./login-guard";
import type { Role } from "@prisma/client";
import { can } from "./permissions";

export type AttentionItem = {
  key: string;
  count: number;
  label: string;
  hint: string;
  href: string;
  /** قرمز = نباید بماند، زرد = بهتر است امروز انجام شود */
  severity: "high" | "medium";
};

/**
 * «امروز چه چیزی از من کار می‌خواهد؟»
 *
 * فقط چیزهایی که واقعاً کاری می‌طلبند برمی‌گردند — اگر همه‌چیز مرتب باشد
 * فهرست خالی است و داشبورد شلوغ نمی‌شود. هر مورد بر اساس دسترسی نقش
 * فیلتر می‌شود تا منشی چیزی نبیند که کارش نیست.
 */
export async function getAttentionItems(role: Role): Promise<AttentionItem[]> {
  const now = new Date();
  const settings = await getSettings();

  const canAppointments = can(role, "appointments.all");
  const canMessages = can(role, "messages");
  const canContent = can(role, "content");
  const canFinance = can(role, "payroll");

  const [
    pendingAppointments,
    overdueFollowUps,
    waitingList,
    openTickets,
    unhappyFeedback,
    unreadMessages,
    pendingTestimonials,
    lowStock,
    backups,
    failedLogins,
    todayUnfinished,
  ] = await Promise.all([
    canAppointments ? prisma.appointment.count({ where: { status: "PENDING" } }) : 0,
    canAppointments
      ? prisma.followUp.count({ where: { status: "OPEN", dueAt: { lte: now } } })
      : 0,
    canAppointments ? prisma.waitlistEntry.count({ where: { status: "WAITING" } }) : 0,
    canMessages
      ? prisma.supportTicket.count({ where: { unreadByStaff: true, status: { not: "CLOSED" } } })
      : 0,
    canContent
      ? prisma.feedback.count({
          where: {
            rating: { lte: UNHAPPY_THRESHOLD },
            status: { in: ["SUBMITTED", "SEEN"] },
          },
        })
      : 0,
    canMessages ? prisma.contactMessage.count({ where: { isRead: false } }) : 0,
    canContent ? prisma.testimonial.count({ where: { isApproved: false } }) : 0,
    canFinance ? lowStockCount() : 0,
    canFinance ? listBackups() : [],
    can(role, "audit") ? recentFailedLogins(24) : 0,
    canAppointments
      ? prisma.appointment.count({
          where: {
            startsAt: { lt: now, gte: new Date(now.getTime() - 24 * 3600_000) },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        })
      : 0,
  ]);

  const items: AttentionItem[] = [];
  const push = (item: AttentionItem) => {
    if (item.count > 0) items.push(item);
  };

  push({
    key: "unhappy",
    count: unhappyFeedback,
    label: "نظر ناراضی رسیدگی‌نشده",
    hint: "مشتری ناراضی بوده و هنوز کسی پیگیری نکرده است.",
    href: "/admin/feedback?filter=unhappy",
    severity: "high",
  });

  push({
    key: "tickets",
    count: openTickets,
    label: "گفت‌وگوی منتظر پاسخ",
    hint: "مشتری پیام داده و منتظر جواب است.",
    href: "/admin/tickets",
    severity: "high",
  });

  push({
    key: "todayUnfinished",
    count: todayUnfinished,
    label: "نوبت گذشته با وضعیت نامشخص",
    hint: "وقتشان گذشته و هنوز «انجام شد» یا «نیامد» نخورده‌اند.",
    href: "/admin/day",
    severity: "high",
  });

  push({
    key: "followups",
    count: overdueFollowUps,
    label: "پیگیری معوق",
    hint: "افرادی که باید با آن‌ها تماس گرفته شود.",
    href: "/admin/followups",
    severity: "medium",
  });

  push({
    key: "pending",
    count: pendingAppointments,
    label: "نوبت در انتظار تأیید",
    hint: "هنوز تأیید نشده‌اند.",
    href: "/admin/appointments?status=PENDING",
    severity: "medium",
  });

  push({
    key: "lowStock",
    count: lowStock,
    label: "قلم انبار رو به اتمام",
    hint: "پیش از تمام‌شدن سفارش بدهید.",
    href: "/admin/inventory",
    severity: "medium",
  });

  push({
    key: "waitlist",
    count: waitingList,
    label: "نفر در لیست انتظار",
    hint: "اگر نوبتی خالی شد، خبرشان کنید.",
    href: "/admin/waitlist",
    severity: "medium",
  });

  push({
    key: "messages",
    count: unreadMessages,
    label: "پیام تماس خوانده‌نشده",
    hint: "از فرم تماس سایت.",
    href: "/admin/messages",
    severity: "medium",
  });

  push({
    key: "testimonials",
    count: pendingTestimonials,
    label: "نظر در انتظار تأیید",
    hint: "تا تأیید نشوند در سایت دیده نمی‌شوند.",
    href: "/admin/testimonials",
    severity: "medium",
  });

  // تلاش‌های ناموفق ورود: تک‌وتوک یعنی کسی رمزش را اشتباه زده و مهم نیست؛
  // انبوهش یعنی یک نفر دارد رمز را حدس می‌زند
  if (failedLogins >= 10) {
    items.push({
      key: "failedLogins",
      count: failedLogins,
      label: "تلاش ناموفق ورود در ۲۴ ساعت",
      hint: "ممکن است کسی در حال حدس‌زدن رمز باشد. گزارش فعالیت را ببینید.",
      href: "/admin/audit?group=security&days=1",
      severity: "high",
    });
  }

  // پشتیبان‌گیری: نبودش یا کهنه‌بودنش هر دو مهم است
  if (canFinance) {
    const last = backups[0];
    const days = last ? Math.floor((now.getTime() - last.createdAt.getTime()) / 86_400_000) : null;
    if (days === null) {
      items.push({
        key: "backup",
        count: 1,
        label: "هنوز پشتیبان نگرفته‌اید",
        hint: "پرونده‌های پزشکی قابل بازسازی نیستند.",
        href: "/admin/backup",
        severity: "high",
      });
    } else if (days >= 2) {
      items.push({
        key: "backup",
        count: days,
        label: "روز است پشتیبان گرفته نشده",
        hint: "یک نسخه بگیرید و روی گوشی‌تان نگه دارید.",
        href: "/admin/backup",
        severity: "medium",
      });
    }
  }

  // پیامک خاموش یعنی مشتری نمی‌تواند وارد شود — همیشه بالای فهرست
  const smsProvider = (settings.smsProvider ?? process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const smsReady =
    smsProvider === "melipayamak" || smsProvider === "meli"
      ? !!process.env.MELIPAYAMAK_USERNAME && !!process.env.MELIPAYAMAK_PASSWORD
      : smsProvider === "kavenegar" && !!process.env.KAVENEGAR_API_KEY;

  if (canFinance && !smsReady) {
    items.unshift({
      key: "sms",
      count: 1,
      label: "پیامک وصل نیست",
      hint: "بدون آن مشتری نمی‌تواند وارد حسابش شود و یادآوری‌ها نمی‌روند.",
      href: "/admin/notifications",
      severity: "high",
    });
  }

  return items;
}
