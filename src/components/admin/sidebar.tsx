"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CreditCard, FileSignature, FileText, Home, Image as ImageIcon, LayoutDashboard, LogOut, Menu, MessageSquare, PhoneCall, Quote, Send, Settings, Sparkles, Users, Wallet, X } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { can, ROLE_LABELS, type Permission } from "@/lib/permissions";
import { cn, toFa } from "@/lib/utils";
import type { Role } from "@prisma/client";

const NAV: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  exact?: boolean;
  badgeKey?: keyof SidebarBadges;
}[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, permission: "dashboard", exact: true },
  { href: "/admin/appointments", label: "نوبت‌ها", icon: CalendarDays, permission: "appointments.all", badgeKey: "pendingAppointments" },
  { href: "/admin/my", label: "نوبت‌های من", icon: CalendarDays, permission: "appointments.own", exact: true },
  { href: "/admin/followups", label: "پیگیری مراجعین", icon: PhoneCall, permission: "appointments.all", badgeKey: "openFollowUps" },
  { href: "/admin/customers", label: "مشتریان", icon: Users, permission: "customers" },
  { href: "/admin/services", label: "خدمات", icon: Sparkles, permission: "content" },
  { href: "/admin/staff", label: "پرسنل", icon: Users, permission: "staff" },
  { href: "/admin/payments", label: "پرداخت‌ها", icon: CreditCard, permission: "payroll" },
  { href: "/admin/payroll", label: "حقوق و دستمزد", icon: Wallet, permission: "payroll" },
  { href: "/admin/my/earnings", label: "درآمد من", icon: Wallet, permission: "payroll.own" },
  { href: "/admin/consents", label: "رضایت‌نامه‌ها", icon: FileSignature, permission: "content" },
  { href: "/admin/gallery", label: "گالری", icon: ImageIcon, permission: "content" },
  { href: "/admin/blog", label: "مجله", icon: FileText, permission: "content" },
  { href: "/admin/testimonials", label: "نظرات", icon: Quote, permission: "content", badgeKey: "pendingTestimonials" },
  { href: "/admin/messages", label: "پیام‌ها", icon: MessageSquare, permission: "messages", badgeKey: "unreadMessages" },
  { href: "/admin/users", label: "کاربران", icon: Users, permission: "users" },
  { href: "/admin/notifications", label: "پیامک و ایمیل", icon: Send, permission: "notifications" },
  { href: "/admin/settings", label: "تنظیمات", icon: Settings, permission: "settings" },
];

export type SidebarBadges = {
  pendingAppointments?: number;
  pendingTestimonials?: number;
  unreadMessages?: number;
  openFollowUps?: number;
};

export function Sidebar({
  user,
  badges,
}: {
  user: { name: string; email: string; role: Role };
  badges: SidebarBadges;
}) {
  const visibleNav = NAV.filter((item) => can(user.role, item.permission));
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const content = (
    <>
      <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-6 py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-plum-500 text-white">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">پنل مدیریت</p>
          <p className="truncate text-[11px] text-[color:var(--fg-muted)]">کلینیک شهرزاد</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="منوی مدیریت">
        {visibleNav.map((item) => {
          const count = item.badgeKey ? badges[item.badgeKey] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                isActive(item.href, item.exact)
                  ? "bg-rose-500 text-white shadow-[0_6px_18px_-8px_rgba(183,110,121,0.9)]"
                  : "text-[color:var(--fg-muted)] hover:bg-[color:var(--bg-sunken)] hover:text-[color:var(--fg)]"
              )}
            >
              <item.icon className="size-[18px] shrink-0" />
              <span className="flex-1">{item.label}</span>
              {!!count && count > 0 && (
                <span
                  className={cn(
                    "grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                    isActive(item.href, item.exact)
                      ? "bg-white/25 text-white"
                      : "bg-rose-500 text-white"
                  )}
                >
                  {toFa(count)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-[color:var(--line)] p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-[color:var(--bg-sunken)] p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-200 to-cream-200 font-bold text-plum-600 dark:from-rose-500/25 dark:to-plum-700 dark:text-rose-100">
            {user.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-[11px] text-[color:var(--fg-muted)]">{ROLE_LABELS[user.role]}</p>
          </div>
          <ThemeToggle className="size-9" />
        </div>

        <Link
          href="/"
          className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm text-[color:var(--fg-muted)] transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <Home className="size-[18px]" />
          مشاهده‌ی سایت
        </Link>

        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            <LogOut className="size-[18px]" />
            خروج از حساب
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* نوار موبایل */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="باز کردن منو"
          className="grid size-10 place-items-center rounded-xl border border-[color:var(--line)]"
        >
          <Menu className="size-5" />
        </button>
        <p className="text-sm font-bold">پنل مدیریت</p>
        <ThemeToggle />
      </div>

      {/* سایدبار دسکتاپ */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-[color:var(--line)] bg-[color:var(--bg-elevated)] lg:flex">
        {content}
      </aside>

      {/* کشوی موبایل */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-plum-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 flex-col bg-[color:var(--bg-elevated)] shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن منو"
              className="absolute left-4 top-5 z-10 grid size-9 place-items-center rounded-full hover:bg-[color:var(--bg-sunken)]"
            >
              <X className="size-5" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
