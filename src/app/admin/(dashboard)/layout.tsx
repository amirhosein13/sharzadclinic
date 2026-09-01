import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/admin/sidebar";

export const metadata: Metadata = {
  title: { default: "پنل مدیریت", template: "%s | پنل مدیریت" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/admin/login");

  const [pendingAppointments, pendingTestimonials, unreadMessages] = await Promise.all([
    prisma.appointment.count({ where: { status: "PENDING" } }),
    prisma.testimonial.count({ where: { isApproved: false } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
  ]);

  return (
    <div className="flex min-h-dvh bg-[color:var(--bg-sunken)]">
      <Sidebar
        user={{ name: user.name, email: user.email, role: user.role }}
        badges={{ pendingAppointments, pendingTestimonials, unreadMessages }}
      />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl p-5 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
