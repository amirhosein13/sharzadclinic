import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/admin/sidebar";
import { can } from "@/lib/permissions";
import { lowStockCount } from "@/lib/inventory";

export const metadata: Metadata = {
  title: { default: "پنل مدیریت", template: "%s | پنل مدیریت" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/admin/login");

  // شمارنده‌های سایدبار فقط برای نقش‌هایی که آن بخش‌ها را می‌بینند
  const [pendingAppointments, pendingTestimonials, unreadMessages, openFollowUps, waitingList, openFeedback, lowStock] =
    await Promise.all([
      can(user.role, "appointments.all") ? prisma.appointment.count({ where: { status: "PENDING" } }) : 0,
      can(user.role, "content") ? prisma.testimonial.count({ where: { isApproved: false } }) : 0,
      can(user.role, "messages") ? prisma.contactMessage.count({ where: { isRead: false } }) : 0,
      can(user.role, "appointments.all")
        ? prisma.followUp.count({ where: { status: "OPEN", dueAt: { lte: new Date() } } })
        : 0,
      can(user.role, "appointments.all")
        ? prisma.waitlistEntry.count({ where: { status: "WAITING" } })
        : 0,
      can(user.role, "content")
        ? prisma.feedback.count({
            where: { submittedAt: { not: null }, status: { in: ["SUBMITTED", "SEEN"] } },
          })
        : 0,
      can(user.role, "payroll") ? lowStockCount() : 0,
    ]);

  return (
    <div className="flex min-h-dvh bg-[color:var(--bg-sunken)]">
      <Sidebar
        user={{ name: user.name, email: user.email, role: user.role }}
        badges={{
          pendingAppointments,
          pendingTestimonials,
          unreadMessages,
          openFollowUps,
          waitingList,
          openFeedback,
          lowStock,
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl p-5 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
