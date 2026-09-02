"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseJalaliInput } from "@/lib/date";
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
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("دسترسی لازم برای این کار را ندارید.");
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد.");
  }
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const num = (v: FormDataEntryValue | null): number => {
  const s = text(v);
  if (!s) return 0;
  const n = Number(toEn(s));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export async function savePackage(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const id = text(formData.get("id"));
    const customerId = text(formData.get("customerId"));
    const serviceId = text(formData.get("serviceId"));
    const totalSessions = num(formData.get("totalSessions"));
    const price = num(formData.get("price"));
    const paidAmount = num(formData.get("paidAmount"));
    const expiresRaw = text(formData.get("expiresAt"));

    if (!customerId || !serviceId) return FAIL("مشتری و خدمت را انتخاب کنید.");
    if (totalSessions < 1 || totalSessions > 100) {
      return FAIL("تعداد جلسات باید بین ۱ تا ۱۰۰ باشد.", { totalSessions: "تعداد نامعتبر" });
    }
    if (price < 0 || paidAmount < 0) return FAIL("مبلغ نمی‌تواند منفی باشد.");
    if (paidAmount > price) {
      return FAIL("مبلغ دریافتی از قیمت کل بیشتر است.", { paidAmount: "بیش از قیمت کل" });
    }

    let expiresAt: Date | null = null;
    if (expiresRaw) {
      expiresAt = parseJalaliInput(expiresRaw);
      if (!expiresAt) {
        return FAIL("تاریخ انقضا نامعتبر است.", { expiresAt: "به شکل ۱۴۰۵/۱۲/۲۹ وارد کنید" });
      }
    }

    const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    const data = {
      customerId,
      serviceId,
      title: text(formData.get("title")) || `دوره‌ی ${service.title}`,
      totalSessions,
      price,
      paidAmount,
      expiresAt,
      note: text(formData.get("note")) || null,
    };

    if (id) await prisma.package.update({ where: { id }, data });
    else await prisma.package.create({ data });

    revalidatePath(`/admin/customers/${customerId}`);
    revalidatePath("/admin/packages");
    revalidatePath("/account");
    return OK(id ? "پکیج به‌روزرسانی شد." : `پکیج «${data.title}» ثبت شد.`);
  }) as Promise<FormResult>;
}

export async function deletePackage(id: string): Promise<FormResult> {
  return guard(async () => {
    const pkg = await prisma.package.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { treatments: true, appointments: true } } },
    });
    const used = pkg._count.treatments + pkg._count.appointments;
    if (used > 0) {
      return FAIL("این پکیج به جلسات ثبت‌شده وصل است و حذف نمی‌شود. به‌جای حذف، غیرفعالش کنید.");
    }
    await prisma.package.delete({ where: { id } });
    revalidatePath(`/admin/customers/${pkg.customerId}`);
    revalidatePath("/admin/packages");
    return OK("پکیج حذف شد.");
  }) as Promise<FormResult>;
}

/** ثبت دریافت قسط بعدی پکیج */
export async function addPackagePayment(id: string, amount: number): Promise<FormResult> {
  return guard(async () => {
    const pkg = await prisma.package.findUniqueOrThrow({ where: { id } });
    const next = pkg.paidAmount + amount;
    if (amount <= 0) return FAIL("مبلغ باید بیشتر از صفر باشد.");
    if (next > pkg.price) return FAIL("مجموع دریافتی از قیمت کل پکیج بیشتر می‌شود.");

    await prisma.$transaction([
      prisma.package.update({ where: { id }, data: { paidAmount: next } }),
      prisma.payment.create({
        data: {
          customerId: pkg.customerId,
          amount,
          method: "CASH",
          status: "PAID",
          paidAt: new Date(),
          note: `قسط پکیج «${pkg.title}»`,
        },
      }),
    ]);

    revalidatePath(`/admin/customers/${pkg.customerId}`);
    revalidatePath("/admin/packages");
    return OK("پرداخت ثبت شد.");
  }) as Promise<FormResult>;
}

/** اتصال یک جلسه‌ی ثبت‌شده به پکیج، برای کم‌شدن از موجودی */
export async function attachTreatmentToPackage(
  treatmentId: string,
  packageId: string | null
): Promise<FormResult> {
  return guard(async () => {
    const record = await prisma.treatmentRecord.update({
      where: { id: treatmentId },
      data: { packageId },
    });
    revalidatePath(`/admin/customers/${record.customerId}`);
    return OK(packageId ? "جلسه به پکیج وصل شد." : "اتصال جلسه به پکیج برداشته شد.");
  }) as Promise<FormResult>;
}
