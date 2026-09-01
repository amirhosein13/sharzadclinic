import "server-only";
import { prisma } from "./prisma";

export type PayrollLine = {
  appointmentId: string;
  date: Date;
  serviceTitle: string;
  customerName: string;
  /** مبلغی که مبنای پورسانت است */
  amount: number;
  commissionPercent: number;
  commission: number;
  /** آیا مبلغ از پرداخت ثبت‌شده آمده یا از قیمت پایه‌ی خدمت تخمین زده شده */
  estimated: boolean;
};

export type PayrollComputation = {
  staffId: string;
  staffName: string;
  baseSalary: number;
  commissionBase: number;
  commissionAmount: number;
  sessionCount: number;
  /** تعداد جلساتی که پرداختشان ثبت نشده و مبلغشان تخمینی است */
  estimatedCount: number;
  lines: PayrollLine[];
};

/**
 * حقوق یک پرسنل را در بازه‌ی داده‌شده محاسبه می‌کند.
 *
 * مبنای پورسانت هر جلسه:
 *   ۱. اگر برای نوبت پرداخت موفق ثبت شده باشد → مجموع همان پرداخت‌ها
 *   ۲. در غیر این صورت → حداقل قیمت خدمت (به‌عنوان تخمین، با علامت‌گذاری)
 *
 * درصد پورسانت: اگر برای آن خدمت درصد اختصاصی تعریف شده باشد همان،
 * وگرنه درصد پیش‌فرض خود پرسنل.
 */
export async function computePayroll(
  staffId: string,
  from: Date,
  to: Date
): Promise<PayrollComputation> {
  const staff = await prisma.staff.findUniqueOrThrow({
    where: { id: staffId },
    include: { services: { select: { serviceId: true, commissionPercent: true } } },
  });

  const percentByService = new Map(
    staff.services.map((s) => [s.serviceId, s.commissionPercent ?? staff.commissionPercent])
  );

  const appointments = await prisma.appointment.findMany({
    where: { staffId, status: "DONE", startsAt: { gte: from, lte: to } },
    include: {
      service: { select: { title: true, priceFrom: true } },
      customer: { select: { firstName: true, lastName: true } },
      payments: { where: { status: "PAID" }, select: { amount: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const lines: PayrollLine[] = appointments.map((appt) => {
    const paid = appt.payments.reduce((sum, p) => sum + p.amount, 0);
    const estimated = appt.payments.length === 0;
    const amount = estimated ? (appt.service.priceFrom ?? 0) : paid;
    const percent = percentByService.get(appt.serviceId) ?? staff.commissionPercent;

    return {
      appointmentId: appt.id,
      date: appt.startsAt,
      serviceTitle: appt.service.title,
      customerName: `${appt.customer.firstName} ${appt.customer.lastName}`,
      amount,
      commissionPercent: percent,
      commission: Math.round((amount * percent) / 100),
      estimated,
    };
  });

  return {
    staffId,
    staffName: staff.name,
    baseSalary: staff.baseSalary,
    commissionBase: lines.reduce((sum, l) => sum + l.amount, 0),
    commissionAmount: lines.reduce((sum, l) => sum + l.commission, 0),
    sessionCount: lines.length,
    estimatedCount: lines.filter((l) => l.estimated).length,
    lines,
  };
}

/** محاسبه‌ی حقوق همه‌ی پرسنل فعال در یک بازه */
export async function computeAllPayroll(from: Date, to: Date): Promise<PayrollComputation[]> {
  const staff = await prisma.staff.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  return Promise.all(staff.map((s) => computePayroll(s.id, from, to)));
}

/** جمع نهایی یک فیش حقوقی */
export function payrollTotal(input: {
  baseSalary: number;
  commissionAmount: number;
  bonus: number;
  deduction: number;
}): number {
  return input.baseSalary + input.commissionAmount + input.bonus - input.deduction;
}
