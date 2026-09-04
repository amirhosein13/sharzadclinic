"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import {
  customerSchema, fieldErrors, timeOffSchema, treatmentSchema, walkInSchema,
} from "@/lib/validators";
import { atTime, parseJalaliInput, parseYmdKey } from "@/lib/date";
import { normalizeSource } from "@/lib/referral-sources";
import { generateBookingCode } from "@/lib/utils";
import { deletePrivateFile } from "@/lib/upload";
import { consumeForService } from "@/lib/inventory";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

/** پذیرش، مدیر و مدیر کل به این ابزارها دسترسی دارند */
async function guard<T>(fn: () => Promise<T>): Promise<T | FormResult> {
  try {
    await requireRole("ADMIN", "MANAGER", "RECEPTION");
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("دسترسی لازم برای این کار را ندارید.");
    if (message.includes("Unique constraint")) {
      return FAIL("مشتری دیگری با همین شماره موبایل ثبت شده است.");
    }
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد.");
  }
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const nullable = (v: string | undefined | null) => (v && v.trim() !== "" ? v.trim() : null);

// ─── مشتری ─────────────────────────────────────────────────────

export async function saveCustomer(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const id = text(formData.get("id"));
    const parsed = customerSchema.safeParse({
      firstName: text(formData.get("firstName")),
      lastName: text(formData.get("lastName")),
      phone: text(formData.get("phone")),
      email: text(formData.get("email")),
      nationalCode: text(formData.get("nationalCode")),
      gender: text(formData.get("gender")) || "FEMALE",
      birthDate: text(formData.get("birthDate")),
      address: text(formData.get("address")),
      notes: text(formData.get("notes")),
      allergies: text(formData.get("allergies")),
      referralSource: text(formData.get("referralSource")),
      referralNote: text(formData.get("referralNote")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;

    let birthDate: Date | null = null;
    if (v.birthDate) {
      birthDate = parseJalaliInput(v.birthDate);
      if (!birthDate) {
        return FAIL("تاریخ تولد نامعتبر است.", { birthDate: "به شکل ۱۳۷۰/۰۵/۱۲ وارد کنید" });
      }
    }

    const data = {
      firstName: v.firstName,
      lastName: v.lastName,
      phone: v.phone,
      email: nullable(v.email),
      nationalCode: nullable(v.nationalCode),
      gender: v.gender ?? "FEMALE",
      birthDate,
      address: nullable(v.address),
      notes: nullable(v.notes),
      allergies: nullable(v.allergies),
      referralSource: normalizeSource(v.referralSource),
      referralNote: nullable(v.referralNote),
    };

    // شماره‌ی تکراری را پیش از نوشتن می‌گیریم تا پیام روشن‌تری بدهیم
    const clash = await prisma.customer.findFirst({
      where: { phone: v.phone, NOT: id ? { id } : undefined },
      select: { firstName: true, lastName: true },
    });
    if (clash) {
      return FAIL(
        `این شماره قبلاً برای «${clash.firstName} ${clash.lastName}» ثبت شده است.`,
        { phone: "شماره تکراری است" }
      );
    }

    const saved = id
      ? await prisma.customer.update({ where: { id }, data })
      : await prisma.customer.create({ data });

    await logAction({
      action: id ? "customer.update" : "customer.create",
      entity: "Customer",
      entityId: saved.id,
    });
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${saved.id}`);
    return OK(id ? "اطلاعات مشتری به‌روزرسانی شد." : `مشتری «${v.firstName} ${v.lastName}» ثبت شد.`);
  }) as Promise<FormResult>;
}

export async function deleteCustomer(id: string): Promise<FormResult> {
  return guard(async () => {
    await requireRole("ADMIN", "MANAGER");
    const counts = await prisma.customer.findUniqueOrThrow({
      where: { id },
      select: { _count: { select: { appointments: true, treatments: true, payments: true } } },
    });
    const total =
      counts._count.appointments + counts._count.treatments + counts._count.payments;
    if (total > 0) {
      return FAIL(
        "این مشتری سابقه‌ی ثبت‌شده دارد و حذف نمی‌شود. به‌جای حذف، محدودش کنید."
      );
    }
    await prisma.customer.delete({ where: { id } });
    revalidatePath("/admin/customers");
    return OK("مشتری حذف شد.");
  }) as Promise<FormResult>;
}

// ─── سوابق درمان (ورود پرونده‌های کاغذی) ───────────────────────

export async function saveTreatment(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const id = text(formData.get("id"));
    const parsed = treatmentSchema.safeParse({
      customerId: text(formData.get("customerId")),
      serviceId: text(formData.get("serviceId")),
      packageId: text(formData.get("packageId")),
      staffId: text(formData.get("staffId")),
      performedAt: text(formData.get("performedAt")),
      sessionNo: text(formData.get("sessionNo")),
      description: text(formData.get("description")),
      beforePhoto: text(formData.get("beforePhoto")),
      afterPhoto: text(formData.get("afterPhoto")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const performedAt = parseJalaliInput(v.performedAt);
    if (!performedAt) {
      return FAIL("تاریخ نامعتبر است.", { performedAt: "به شکل ۱۴۰۵/۰۶/۱۵ وارد کنید" });
    }
    if (performedAt > new Date()) {
      return FAIL("تاریخ مراجعه نمی‌تواند در آینده باشد.", { performedAt: "تاریخ در آینده است" });
    }

    const data = {
      customerId: v.customerId,
      serviceId: nullable(v.serviceId),
      packageId: nullable(v.packageId),
      staffId: nullable(v.staffId),
      performedAt,
      sessionNo: v.sessionNo,
      description: nullable(v.description),
      beforePhoto: nullable(v.beforePhoto),
      afterPhoto: nullable(v.afterPhoto),
    };

    if (id) {
      const before = await prisma.treatmentRecord.findUnique({
        where: { id },
        select: { beforePhoto: true, afterPhoto: true },
      });
      await prisma.treatmentRecord.update({ where: { id }, data });
      // عکس‌های جایگزین‌شده روی دیسک نمانند
      if (before?.beforePhoto && before.beforePhoto !== data.beforePhoto) {
        await deletePrivateFile(before.beforePhoto);
      }
      if (before?.afterPhoto && before.afterPhoto !== data.afterPhoto) {
        await deletePrivateFile(before.afterPhoto);
      }
    } else {
      const created = await prisma.treatmentRecord.create({ data });
      // مواد مصرفی این خدمت خودکار از انبار کم می‌شود
      if (created.serviceId) {
        await consumeForService(created.serviceId, created.id).catch((error) => {
          // کسر انبار نباید جلوی ثبت پرونده‌ی درمانی را بگیرد
          console.error("کسر خودکار انبار انجام نشد:", error);
        });
      }
    }

    revalidatePath(`/admin/customers/${v.customerId}`);
    revalidatePath("/account");
    return OK(id ? "سابقه به‌روزرسانی شد." : "سابقه‌ی مراجعه ثبت شد.");
  }) as Promise<FormResult>;
}

export async function deleteTreatment(id: string): Promise<FormResult> {
  return guard(async () => {
    const record = await prisma.treatmentRecord.delete({ where: { id } });
    await deletePrivateFile(record.beforePhoto);
    await deletePrivateFile(record.afterPhoto);
    revalidatePath(`/admin/customers/${record.customerId}`);
    revalidatePath("/account");
    return OK("سابقه حذف شد.");
  }) as Promise<FormResult>;
}

// ─── نوبت حضوری ────────────────────────────────────────────────

/**
 * ثبت نوبت توسط منشی. برخلاف رزرو آنلاین، محدودیت‌های ساعت کاری و
 * مهلت رزرو اعمال نمی‌شود (مراجع حضوری ممکن است خارج از برنامه باشد)،
 * اما تداخل با نوبت‌های دیگرِ همان پرسنل بررسی می‌شود.
 */
export async function createWalkIn(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const parsed = walkInSchema.safeParse({
      customerId: text(formData.get("customerId")),
      serviceId: text(formData.get("serviceId")),
      staffId: text(formData.get("staffId")),
      dateKey: text(formData.get("dateKey")),
      time: text(formData.get("time")),
      status: text(formData.get("status")) || "CONFIRMED",
      adminNote: text(formData.get("adminNote")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const service = await prisma.service.findUniqueOrThrow({ where: { id: v.serviceId } });
    const startsAt = atTime(parseYmdKey(v.dateKey), v.time);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    const staffId = nullable(v.staffId);
    if (staffId) {
      const clash = await prisma.appointment.findFirst({
        where: {
          staffId,
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
        },
        include: { customer: { select: { firstName: true, lastName: true } } },
      });
      if (clash) {
        return FAIL(
          `این پرسنل در آن ساعت نوبت «${clash.customer.firstName} ${clash.customer.lastName}» را دارد.`
        );
      }
    }

    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      try {
        created = await prisma.appointment.create({
          data: {
            code: generateBookingCode(),
            customerId: v.customerId,
            serviceId: v.serviceId,
            staffId,
            startsAt,
            endsAt,
            status: v.status ?? "CONFIRMED",
            adminNote: nullable(v.adminNote),
            source: "reception",
          },
        });
      } catch {
        // برخورد کد پیگیری
      }
    }
    if (!created) return FAIL("ثبت نوبت با خطا مواجه شد.");

    revalidatePath("/admin/appointments");
    revalidatePath(`/admin/customers/${v.customerId}`);
    return OK(`نوبت با کد ${created.code} ثبت شد.`);
  }) as Promise<FormResult>;
}

// ─── مرخصی و تعطیلی ────────────────────────────────────────────

export async function saveTimeOff(formData: FormData): Promise<FormResult> {
  return guard(async () => {
    const parsed = timeOffSchema.safeParse({
      staffId: text(formData.get("staffId")),
      fromDate: text(formData.get("fromDate")),
      toDate: text(formData.get("toDate")),
      fromTime: text(formData.get("fromTime")) || "00:00",
      toTime: text(formData.get("toTime")) || "23:59",
      reason: text(formData.get("reason")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const from = atTime(parseYmdKey(v.fromDate), v.fromTime ?? "00:00");
    const to = atTime(parseYmdKey(v.toDate), v.toTime ?? "23:59");
    if (to <= from) return FAIL("پایان مرخصی باید بعد از شروع آن باشد.");

    const staffId = nullable(v.staffId);

    // هشدار درباره‌ی نوبت‌هایی که در این بازه ثبت شده‌اند
    const affected = await prisma.appointment.count({
      where: {
        ...(staffId ? { staffId } : {}),
        status: { in: ["PENDING", "CONFIRMED"] },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
    });

    await prisma.timeOff.create({
      data: { staffId, from, to, reason: nullable(v.reason) },
    });

    revalidatePath("/admin/staff");
    return OK(
      affected > 0
        ? `مرخصی ثبت شد، اما ${affected} نوبت در این بازه از قبل وجود دارد که باید جابه‌جا شود.`
        : "مرخصی ثبت شد و در این بازه نوبت آنلاین داده نمی‌شود."
    );
  }) as Promise<FormResult>;
}

export async function deleteTimeOff(id: string): Promise<FormResult> {
  return guard(async () => {
    await prisma.timeOff.delete({ where: { id } });
    revalidatePath("/admin/staff");
    return OK("مرخصی حذف شد.");
  }) as Promise<FormResult>;
}
