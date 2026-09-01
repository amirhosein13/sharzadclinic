"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import { computePayroll, payrollTotal } from "@/lib/payroll";
import { fieldErrors, paymentSchema } from "@/lib/validators";
import { jalaliMonthRange } from "@/lib/date";
import { toEn } from "@/lib/utils";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

async function guard<T>(fn: () => Promise<T>): Promise<T | FormResult> {
  try {
    await requireRole("ADMIN", "MANAGER");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("فقط مدیر کلینیک به بخش حقوق دسترسی دارد.");
    console.error(error);
    return FAIL("عملیات با خطا مواجه شد.");
  }
}

const num = (v: FormDataEntryValue | null): number => {
  if (typeof v !== "string" || v.trim() === "") return 0;
  const n = Number(toEn(v));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/**
 * فیش حقوقی یک پرسنل را برای ماه مشخص می‌سازد یا به‌روزرسانی می‌کند.
 * مبالغ در لحظه‌ی ذخیره «قفل» می‌شوند تا تغییرات بعدی نوبت‌ها فیش صادرشده
 * را عوض نکند.
 */
export async function savePayrollPeriod(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const staffId = String(formData.get("staffId") ?? "");
    const monthOffset = Number(formData.get("monthOffset") ?? 0);
    if (!staffId) return FAIL("پرسنل مشخص نشده است.");

    const range = jalaliMonthRange(monthOffset);
    const computed = await computePayroll(staffId, range.from, range.to);

    const bonus = num(formData.get("bonus"));
    const deduction = num(formData.get("deduction"));
    if (bonus < 0 || deduction < 0) return FAIL("پاداش و کسورات نمی‌تواند منفی باشد.");

    const total = payrollTotal({
      baseSalary: computed.baseSalary,
      commissionAmount: computed.commissionAmount,
      bonus,
      deduction,
    });
    if (total < 0) return FAIL("کسورات از مجموع حقوق بیشتر است.");

    const data = {
      label: range.label,
      baseSalary: computed.baseSalary,
      commissionBase: computed.commissionBase,
      commissionAmount: computed.commissionAmount,
      sessionCount: computed.sessionCount,
      bonus,
      deduction,
      total,
      note: String(formData.get("note") ?? "").trim() || null,
    };

    await prisma.payrollPeriod.upsert({
      where: { staffId_from_to: { staffId, from: range.from, to: range.to } },
      create: { staffId, from: range.from, to: range.to, ...data },
      update: data,
    });

    await logAction({ action: "payroll.save", entity: "PayrollPeriod", detail: `${computed.staffName} — ${range.label}` });
    revalidatePath("/admin/payroll");
    return OK(`فیش حقوقی ${computed.staffName} برای ${range.label} ذخیره شد.`);
  }) as Promise<FormResult>;
}

/** علامت‌زدن فیش به‌عنوان پرداخت‌شده */
export async function togglePayrollPaid(id: string): Promise<FormResult> {
  return guard(async () => {
    const period = await prisma.payrollPeriod.findUniqueOrThrow({
      where: { id },
      include: { staff: { select: { name: true } } },
    });
    await prisma.payrollPeriod.update({
      where: { id },
      data: { isPaid: !period.isPaid, paidAt: period.isPaid ? null : new Date() },
    });
    revalidatePath("/admin/payroll");
    return OK(
      period.isPaid
        ? `فیش ${period.staff.name} به حالت پرداخت‌نشده برگشت.`
        : `فیش ${period.staff.name} پرداخت‌شده علامت خورد.`
    );
  }) as Promise<FormResult>;
}

export async function deletePayrollPeriod(id: string): Promise<FormResult> {
  return guard(async () => {
    await prisma.payrollPeriod.delete({ where: { id } });
    revalidatePath("/admin/payroll");
    return OK("فیش حقوقی حذف شد.");
  }) as Promise<FormResult>;
}

/**
 * ثبت پرداخت برای یک نوبت. مبنای دقیق محاسبه‌ی پورسانت همین است،
 * پس منشی باید بعد از هر جلسه مبلغ دریافتی را وارد کند.
 */
export async function recordPayment(formData: FormData): Promise<FormResult> {
  try {
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
  } catch {
    return FAIL("دسترسی لازم برای ثبت پرداخت را ندارید.");
  }

  const parsed = paymentSchema.safeParse({
    appointmentId: String(formData.get("appointmentId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    method: String(formData.get("method") ?? "CASH"),
    reference: String(formData.get("reference") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

  try {
    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: parsed.data.appointmentId },
      select: { customerId: true, code: true },
    });

    await prisma.payment.create({
      data: {
        customerId: appointment.customerId,
        appointmentId: parsed.data.appointmentId,
        amount: parsed.data.amount,
        method: parsed.data.method,
        status: "PAID",
        paidAt: new Date(),
        reference: parsed.data.reference || null,
        note: parsed.data.note || null,
      },
    });

    revalidatePath("/admin/appointments");
    revalidatePath("/admin/payroll");
    revalidatePath("/admin");
    return OK(`پرداخت نوبت ${appointment.code} ثبت شد.`);
  } catch (error) {
    console.error(error);
    return FAIL("ثبت پرداخت با خطا مواجه شد.");
  }
}

export async function deletePayment(id: string): Promise<FormResult> {
  return guard(async () => {
    await prisma.payment.delete({ where: { id } });
    revalidatePath("/admin/appointments");
    revalidatePath("/admin/payroll");
    return OK("پرداخت حذف شد.");
  }) as Promise<FormResult>;
}
