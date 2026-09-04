import "server-only";
import { prisma } from "./prisma";

/**
 * گزارش فعالیت: «چه کسی چه کاری کرد؟»
 *
 * جدول audit_logs از اول در حال پرشدن بوده ولی هیچ‌جای پنل دیده نمی‌شد؛
 * این‌جا خوانا و قابل فیلترش می‌کنیم.
 */

export type AuditGroupKey =
  | "login"
  | "appointments"
  | "customers"
  | "finance"
  | "content"
  | "settings"
  | "security"
  | "other";

export type AuditGroup = {
  key: AuditGroupKey;
  label: string;
  /** عملیاتی که در این دسته می‌افتند */
  actions?: string[];
  /** یا موجودیت‌هایی که در این دسته می‌افتند */
  entities?: string[];
};

export const AUDIT_GROUPS: AuditGroup[] = [
  { key: "login", label: "ورود و خروج", actions: ["login"] },
  {
    key: "security",
    label: "امنیت",
    actions: [
      "login.failed",
      "password.reset",
      "password.reset.request",
      "password.reset.cli",
      "backup.create",
      "backup.download",
      "backup.restore",
      "user.create",
      "user.update",
    ],
    entities: ["Backup"],
  },
  {
    key: "appointments",
    label: "نوبت‌ها",
    actions: ["appointment.status", "appointment.delete", "appointment.note"],
    entities: ["Appointment", "WaitlistEntry", "FollowUp"],
  },
  {
    key: "customers",
    label: "مشتریان و پرونده",
    actions: ["customer.create", "customer.block", "sign"],
    entities: ["Customer", "consentSignature", "consentTemplate", "TreatmentRecord", "Package"],
  },
  {
    key: "finance",
    label: "مالی و انبار",
    actions: ["payroll.save", "stock.in", "stock.out", "stock.adjust", "cash.close", "cash.reopen"],
    entities: ["Payment", "Expense", "InventoryItem", "PayrollPeriod", "discountCode", "CashClose"],
  },
  {
    key: "content",
    label: "محتوا و خدمات",
    actions: ["service.create", "service.update", "campaign.create", "campaign.send", "campaign.cancel"],
    entities: ["Service", "Post", "GalleryItem", "Testimonial", "Staff", "Campaign"],
  },
  { key: "settings", label: "تنظیمات", actions: ["settings.save"], entities: ["Setting"] },
];

/** عنوان فارسی هر عمل. کلید = `action` یا `action:entity` برای عمل‌های عمومی. */
const ACTION_LABELS: Record<string, string> = {
  login: "ورود به پنل",
  "login.failed": "تلاش ناموفق برای ورود",
  "password.reset": "بازیابی رمز عبور",
  "password.reset.request": "درخواست کد بازیابی رمز",
  "password.reset.cli": "تغییر رمز از روی سرور",
  "appointment.status": "تغییر وضعیت نوبت",
  "appointment.delete": "حذف نوبت",
  "appointment.note": "یادداشت روی نوبت",
  "customer.create": "ثبت مشتری",
  "customer.block": "محدودکردن مشتری",
  sign: "امضای رضایت‌نامه",
  "settings.save": "ذخیره‌ی تنظیمات",
  "payroll.save": "صدور فیش حقوقی",
  "ticket.reply": "پاسخ به گفت‌وگو",
  "feedback.resolved": "رسیدگی به نظر",
  "feedback.seen": "دیدن نظر",
  "service.create": "ساخت خدمت",
  "service.update": "ویرایش خدمت",
  "user.create": "ساخت حساب کاربری",
  "user.update": "ویرایش حساب کاربری",
  "stock.in": "ورود کالا به انبار",
  "stock.out": "خروج کالا از انبار",
  "stock.adjust": "اصلاح موجودی انبار",
  "cash.close": "بستن صندوق",
  "cash.reopen": "بازکردن دوباره‌ی صندوق",
  "campaign.create": "ساخت پیش‌نویس پیامک گروهی",
  "campaign.send": "شروع ارسال پیامک گروهی",
  "campaign.cancel": "توقف پیامک گروهی",
  "backup.create": "گرفتن نسخه‌ی پشتیبان",
  "backup.download": "دانلود نسخه‌ی پشتیبان",
  "backup.restore": "بازگردانی از پشتیبان",
};

/** نام فارسی موجودیت‌ها، برای عمل‌های عمومی مثل create/update/delete */
const ENTITY_LABELS: Record<string, string> = {
  User: "کاربر",
  Customer: "مشتری",
  Appointment: "نوبت",
  Service: "خدمت",
  Staff: "پرسنل",
  Post: "مطلب مجله",
  GalleryItem: "نمونه کار",
  Testimonial: "نظر سایت",
  Payment: "پرداخت",
  Expense: "هزینه",
  InventoryItem: "قلم انبار",
  PayrollPeriod: "فیش حقوقی",
  discountCode: "کد تخفیف",
  consentTemplate: "قالب رضایت‌نامه",
  consentSignature: "رضایت‌نامه‌ی امضاشده",
  TreatmentRecord: "سابقه‌ی درمان",
  Package: "پکیج",
  WaitlistEntry: "لیست انتظار",
  SupportTicket: "گفت‌وگو",
  Feedback: "نظر مشتری",
  Setting: "تنظیمات",
  Backup: "پشتیبان",
  CashClose: "صندوق",
  Campaign: "پیامک گروهی",
  FollowUp: "پیگیری",
};

const GENERIC: Record<string, string> = {
  create: "ساخت",
  update: "ویرایش",
  delete: "حذف",
};

export function describeAction(action: string, entity: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;

  const generic = GENERIC[action];
  const entityLabel = ENTITY_LABELS[entity] ?? entity;
  if (generic) return `${generic} ${entityLabel}`;

  return `${action} — ${entityLabel}`;
}

/** عمل‌هایی که ارزش دارد در فهرست قرمز/زرد دیده شوند */
export function toneOf(action: string): "red" | "amber" | "plain" {
  if (action === "login.failed") return "red";
  if (action.startsWith("password.")) return "amber";
  if (action.startsWith("backup.")) return "amber";
  if (action === "delete" || action.endsWith(".delete")) return "red";
  if (action === "customer.block") return "amber";
  if (action === "cash.reopen") return "amber";
  if (action === "campaign.send") return "amber";
  return "plain";
}

export type AuditRow = {
  id: string;
  createdAt: Date;
  who: string;
  action: string;
  description: string;
  detail: string | null;
  tone: "red" | "amber" | "plain";
};

export type AuditQuery = {
  group?: AuditGroupKey;
  userId?: string;
  /** جستجو در جزئیات — مثلاً یک ایمیل یا نام */
  q?: string;
  days?: number;
  page?: number;
  perPage?: number;
};

export type AuditPage = {
  rows: AuditRow[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

function groupFilter(key?: AuditGroupKey) {
  if (!key) return {};

  if (key === "other") {
    // هرچه در هیچ دسته‌ای نیست
    const actions = AUDIT_GROUPS.flatMap((g) => g.actions ?? []);
    const entities = AUDIT_GROUPS.flatMap((g) => g.entities ?? []);
    return { AND: [{ action: { notIn: actions } }, { entity: { notIn: entities } }] };
  }

  const group = AUDIT_GROUPS.find((g) => g.key === key);
  if (!group) return {};

  const or: object[] = [];
  if (group.actions?.length) or.push({ action: { in: group.actions } });
  if (group.entities?.length) or.push({ entity: { in: group.entities } });
  return or.length ? { OR: or } : {};
}

export async function listAudit(query: AuditQuery = {}): Promise<AuditPage> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(200, Math.max(10, query.perPage ?? 50));
  const days = query.days && query.days > 0 ? query.days : null;

  const where = {
    ...groupFilter(query.group),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.q?.trim()
      ? { detail: { contains: query.q.trim(), mode: "insensitive" as const } }
      : {}),
    ...(days ? { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return {
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      // تلاش ناموفق ورود کاربری ندارد؛ ایمیلِ امتحان‌شده در detail است
      who: row.user?.name ?? (row.userId ? "کاربر حذف‌شده" : "—"),
      action: row.action,
      description: describeAction(row.action, row.entity),
      detail: row.detail,
      tone: toneOf(row.action),
    })),
  };
}

/** کاربرانی که در گزارش فعالیت ردی دارند — برای فیلتر */
export async function auditActors(): Promise<{ id: string; name: string }[]> {
  const users = await prisma.user.findMany({
    where: { auditLogs: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users;
}
