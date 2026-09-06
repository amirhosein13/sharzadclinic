import type { Role } from "@prisma/client";

/**
 * دسترسی‌های هر نقش. مبنای نمایش منو و محافظت از صفحات و اکشن‌هاست.
 *
 *  ADMIN     مدیر کل — همه‌چیز، شامل حقوق و کاربران
 *  MANAGER   مدیر — محتوا، نوبت‌ها، مشتریان و حقوق، بدون مدیریت کاربران
 *  RECEPTION منشی — نوبت‌ها، مشتریان و پیام‌ها؛ محتوا و حقوق را نمی‌بیند
 *  OPERATOR  اپراتور/درمانگر — فقط نوبت‌ها و درآمد خودش
 */
export const PERMISSIONS = {
  ADMIN: [
    "dashboard", "appointments.all", "appointments.write", "customers", "customers.write",
    "content", "staff", "payroll", "payroll.write", "users", "settings", "notifications", "messages",
    "audit", "help",
  ],
  MANAGER: [
    "dashboard", "appointments.all", "appointments.write", "customers", "customers.write",
    "content", "staff", "payroll", "payroll.write", "settings", "notifications", "messages",
    "audit", "help",
  ],
  RECEPTION: [
    "dashboard", "appointments.all", "appointments.write", "customers", "customers.write", "messages",
    "help",
  ],
  // راهنما را همه می‌بینند — هر نقشی فقط بخش‌های خودش را
  OPERATOR: ["dashboard.own", "appointments.own", "payroll.own", "help"],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS][number];

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[role] as readonly string[]).includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدیر کل",
  MANAGER: "مدیر",
  RECEPTION: "منشی / پذیرش",
  OPERATOR: "اپراتور / درمانگر",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "دسترسی کامل به همه‌ی بخش‌ها، از جمله حقوق پرسنل و مدیریت کاربران.",
  MANAGER: "همه‌چیز به‌جز ساخت و حذف حساب کاربری.",
  RECEPTION: "ثبت و مدیریت نوبت‌ها، مشتریان و پیام‌ها. محتوای سایت و حقوق را نمی‌بیند.",
  OPERATOR: "فقط نوبت‌ها و درآمد خودش را می‌بیند. باید به یکی از پرسنل متصل شود.",
};

/** آیا این نقش فقط داده‌ی خودش را می‌بیند؟ */
export function isSelfScoped(role: Role): boolean {
  return role === "OPERATOR";
}
