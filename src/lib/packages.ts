import "server-only";
import { prisma } from "./prisma";

export type PackageSummary = {
  id: string;
  title: string;
  serviceId: string;
  serviceTitle: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  price: number;
  paidAmount: number;
  remainingAmount: number;
  purchasedAt: Date;
  expiresAt: Date | null;
  isExpired: boolean;
  isFinished: boolean;
  note: string | null;
};

/**
 * جلسات مصرف‌شده از روی رکوردهای واقعی شمرده می‌شوند، نه یک شمارنده‌ی
 * جداگانه. این‌طور اگر جلسه‌ای حذف یا جابه‌جا شود، عدد خودش درست می‌ماند.
 */
export async function summarizePackages(customerId: string): Promise<PackageSummary[]> {
  const packages = await prisma.package.findMany({
    where: { customerId },
    include: {
      service: { select: { title: true } },
      _count: { select: { treatments: true, appointments: true } },
      appointments: { select: { id: true, status: true } },
      treatments: { select: { id: true } },
    },
    orderBy: { purchasedAt: "desc" },
  });

  const now = new Date();

  return packages.map((pkg) => {
    // هر سابقه‌ی درمان یک جلسه است؛ نوبت انجام‌شده‌ای که سابقه ندارد هم شمرده می‌شود
    const doneAppointments = pkg.appointments.filter((a) => a.status === "DONE").length;
    const used = Math.max(pkg.treatments.length, doneAppointments);
    const remaining = Math.max(0, pkg.totalSessions - used);
    const isExpired = !!pkg.expiresAt && pkg.expiresAt < now;

    return {
      id: pkg.id,
      title: pkg.title,
      serviceId: pkg.serviceId,
      serviceTitle: pkg.service.title,
      totalSessions: pkg.totalSessions,
      usedSessions: used,
      remainingSessions: remaining,
      price: pkg.price,
      paidAmount: pkg.paidAmount,
      remainingAmount: Math.max(0, pkg.price - pkg.paidAmount),
      purchasedAt: pkg.purchasedAt,
      expiresAt: pkg.expiresAt,
      isExpired,
      isFinished: remaining === 0,
      note: pkg.note,
    };
  });
}

/** پکیج‌های فعالِ یک مشتری که هنوز جلسه‌ی باقی‌مانده دارند */
export async function activePackages(customerId: string): Promise<PackageSummary[]> {
  const all = await summarizePackages(customerId);
  return all.filter((p) => !p.isFinished && !p.isExpired);
}
