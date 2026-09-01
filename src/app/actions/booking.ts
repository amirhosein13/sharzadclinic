"use server";

import { prisma } from "@/lib/prisma";
import { bookingSchema, fieldErrors, trackSchema } from "@/lib/validators";
import { getAvailableSlots } from "@/lib/availability";
import { atTime, formatJalaliDateTime, parseYmdKey } from "@/lib/date";
import { generateBookingCode } from "@/lib/utils";

export type BookingResult =
  | { ok: true; code: string; summary: string }
  | { ok: false; message?: string; errors?: Record<string, string> };

export async function createBooking(formData: FormData): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse({
    serviceId: formData.get("serviceId"),
    staffId: formData.get("staffId") || null,
    dateKey: formData.get("dateKey"),
    time: formData.get("time"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const input = parsed.data;

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.isActive || !service.isBookable) {
    return { ok: false, message: "این خدمت در حال حاضر قابل رزرو نیست." };
  }

  // اعتبارسنجی مجدد سمت سرور — جلوی رزرو هم‌زمانِ یک اسلات را می‌گیرد
  const slots = await getAvailableSlots({
    serviceId: input.serviceId,
    dateKey: input.dateKey,
    staffId: input.staffId,
  });
  const slot = slots.find((s) => s.time === input.time);
  if (!slot) {
    return {
      ok: false,
      message: "متأسفانه این ساعت همین الان رزرو شد. لطفاً ساعت دیگری انتخاب کنید.",
    };
  }

  const startsAt = atTime(parseYmdKey(input.dateKey), input.time);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  try {
    const customer = await prisma.customer.upsert({
      where: { phone: input.phone },
      update: { firstName: input.firstName, lastName: input.lastName },
      create: { firstName: input.firstName, lastName: input.lastName, phone: input.phone },
    });

    if (customer.isBlocked) {
      return { ok: false, message: "امکان ثبت نوبت آنلاین برای این شماره وجود ندارد. لطفاً تماس بگیرید." };
    }

    // اگر همین مشتری برای همین ساعت نوبت دارد، تکراری نسازیم
    const duplicate = await prisma.appointment.findFirst({
      where: {
        customerId: customer.id,
        startsAt,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (duplicate) {
      return {
        ok: true,
        code: duplicate.code,
        summary: `${service.title} — ${formatJalaliDateTime(startsAt)}`,
      };
    }

    let appointment = null;
    for (let attempt = 0; attempt < 5 && !appointment; attempt++) {
      const code = generateBookingCode();
      try {
        appointment = await prisma.appointment.create({
          data: {
            code,
            customerId: customer.id,
            serviceId: service.id,
            staffId: slot.staffId,
            startsAt,
            endsAt,
            note: input.note || null,
            status: "PENDING",
            source: "website",
          },
        });
      } catch {
        // برخورد کد پیگیری — دوباره تلاش می‌کنیم
      }
    }

    if (!appointment) {
      return { ok: false, message: "ثبت نوبت با خطا مواجه شد. لطفاً دوباره تلاش کنید." };
    }

    return {
      ok: true,
      code: appointment.code,
      summary: `${service.title} — ${formatJalaliDateTime(startsAt)}`,
    };
  } catch {
    return { ok: false, message: "ثبت نوبت با خطا مواجه شد. لطفاً دوباره تلاش کنید." };
  }
}

export type TrackResult =
  | {
      ok: true;
      appointment: {
        code: string;
        status: string;
        serviceTitle: string;
        staffName: string | null;
        when: string;
        customerName: string;
      };
    }
  | { ok: false; message: string };

export async function trackAppointment(_prev: unknown, formData: FormData): Promise<TrackResult> {
  const parsed = trackSchema.safeParse({
    code: formData.get("code"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { ok: false, message: Object.values(fieldErrors(parsed.error))[0] };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { code: parsed.data.code, customer: { phone: parsed.data.phone } },
    include: { service: true, staff: true, customer: true },
  });

  if (!appointment) {
    return { ok: false, message: "نوبتی با این کد پیگیری و شماره موبایل پیدا نشد." };
  }

  return {
    ok: true,
    appointment: {
      code: appointment.code,
      status: appointment.status,
      serviceTitle: appointment.service.title,
      staffName: appointment.staff?.name ?? null,
      when: formatJalaliDateTime(appointment.startsAt),
      customerName: `${appointment.customer.firstName} ${appointment.customer.lastName}`,
    },
  };
}
