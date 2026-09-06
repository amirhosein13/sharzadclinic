"use server";

import { prisma } from "@/lib/prisma";
import { bookingSchema, fieldErrors, trackSchema } from "@/lib/validators";
import { normalizeSource } from "@/lib/referral-sources";
import { attachReferral } from "@/lib/referrals";
import { noShowProfile } from "@/lib/no-shows";
import { getAvailableSlots, releaseExpiredHolds } from "@/lib/availability";
import { atTime, formatJalaliDateTime, parseYmdKey } from "@/lib/date";
import { generateBookingCode } from "@/lib/utils";
import { notifyBookingCreated, notifyBookingEmail } from "@/lib/notifications";
import { createCustomerSession, getCustomerSession } from "@/lib/customer-auth";
import { getSettings } from "@/lib/settings";
import { isZarinpalConfigured, requestPayment } from "@/lib/zarinpal";

/** مهلت پرداخت بیعانه؛ در این مدت نوبت برای کس دیگری قابل رزرو نیست */
const HOLD_MINUTES = 15;

export type BookingResult =
  | { ok: true; code: string; summary: string; loggedIn: boolean }
  /** نوبت رزرو شد و کاربر باید به درگاه برود */
  | { ok: true; redirectTo: string }
  | { ok: false; message?: string; errors?: Record<string, string> };

export async function createBooking(formData: FormData): Promise<BookingResult> {
  await releaseExpiredHolds().catch(() => 0);

  const session = await getCustomerSession();

  // کاربر واردشده نام و شماره‌اش را دوباره وارد نمی‌کند
  const existingCustomer = session
    ? await prisma.customer.findUnique({ where: { id: session.id } })
    : null;

  const parsed = bookingSchema.safeParse({
    serviceId: formData.get("serviceId"),
    staffId: formData.get("staffId") || null,
    dateKey: formData.get("dateKey"),
    time: formData.get("time"),
    firstName: existingCustomer?.firstName ?? formData.get("firstName"),
    lastName: existingCustomer?.lastName ?? formData.get("lastName"),
    phone: existingCustomer?.phone ?? formData.get("phone"),
    note: formData.get("note") ?? "",
    referralSource: formData.get("referralSource") ?? "",
    referralCode: formData.get("referralCode") ?? "",
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
    const before = await prisma.customer.findUnique({
      where: { phone: input.phone },
      select: { id: true, isBlocked: true, _count: { select: { appointments: true } } },
    });

    if (before?.isBlocked) {
      return { ok: false, message: "امکان ثبت نوبت آنلاین برای این شماره وجود ندارد. لطفاً تماس بگیرید." };
    }

    // «از کجا آشنا شدید» فقط یک بار، هنگام ساخت پرونده، ثبت می‌شود؛ جواب
    // اولین بار درست‌ترین جواب است و رزروهای بعدی نباید بازنویسی‌اش کنند
    const referralSource = normalizeSource(input.referralSource);
    const customer = await prisma.customer.upsert({
      where: { phone: input.phone },
      update: { firstName: input.firstName, lastName: input.lastName },
      create: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        referralSource,
      },
    });

    // کد معرف: خطایش نباید جلوی ثبت نوبت را بگیرد — نوبت مهم‌تر از هدیه است
    if (input.referralCode && !before) {
      await attachReferral({ referredId: customer.id, code: input.referralCode }).catch(
        () => undefined,
      );
    }

    // اگر همین مشتری برای همین ساعت نوبت دارد، تکراری نسازیم
    const duplicate = await prisma.appointment.findFirst({
      where: { customerId: customer.id, startsAt, status: { in: ["PENDING", "CONFIRMED"] } },
    });
    if (duplicate) {
      return {
        ok: true,
        code: duplicate.code,
        summary: `${service.title} — ${formatJalaliDateTime(startsAt)}`,
        loggedIn: !!session,
      };
    }

    // آیا این خدمت برای قطعی‌شدن نیاز به پرداخت بیعانه دارد؟
    const deposit = await depositFor(service.id);

    // کسی که چند بار پشت‌سرهم نیامده، رزرو رایگانش برای کلینیک هزینه دارد.
    // اگر خدمت بیعانه ندارد، درصد عمومی را مبنا می‌گیریم.
    const noShow = await noShowProfile(customer.id);
    const enforced = noShow.requiresDeposit ? Math.max(deposit, await fallbackDeposit(service)) : 0;
    const dueNow = Math.max(deposit, enforced);
    const needsPayment = dueNow > 0 && isZarinpalConfigured();

    // اگر باید بیعانه بگیریم ولی درگاه وصل نیست، نوبت آنلاین را قطعی
    // نمی‌کنیم؛ به‌جایش می‌گوییم تلفنی هماهنگ کند.
    if (noShow.requiresDeposit && !isZarinpalConfigured()) {
      return {
        ok: false,
        message:
          "برای رزرو آنلاین این نوبت لازم است ابتدا با کلینیک تماس بگیرید. لطفاً با ما تماس بگیرید تا هماهنگ کنیم.",
      };
    }

    let appointment = null;
    for (let attempt = 0; attempt < 5 && !appointment; attempt++) {
      try {
        appointment = await prisma.appointment.create({
          data: {
            code: generateBookingCode(),
            customerId: customer.id,
            serviceId: service.id,
            staffId: slot.staffId,
            startsAt,
            endsAt,
            note: input.note || null,
            status: "PENDING",
            source: session ? "website-account" : "website",
            // نوبت تا پایان مهلت پرداخت برای این مشتری قفل می‌شود
            holdExpiresAt: needsPayment ? new Date(Date.now() + HOLD_MINUTES * 60_000) : null,
          },
        });
      } catch {
        // برخورد کد پیگیری — دوباره تلاش می‌کنیم
      }
    }

    if (!appointment) {
      return { ok: false, message: "ثبت نوبت با خطا مواجه شد. لطفاً دوباره تلاش کنید." };
    }

    // ورود خودکار فقط برای مشتری تازه‌وارد. اگر شماره سابقه داشته باشد،
    // ورود بدون تأیید پیامکی یعنی هرکسی می‌توانست پرونده‌ی دیگری را ببیند.
    const isNewCustomer = !before || before._count.appointments === 0;
    if (!session && isNewCustomer) {
      await createCustomerSession({
        id: customer.id,
        phone: customer.phone,
        name: `${customer.firstName} ${customer.lastName}`,
      }).catch(() => undefined);
    }

    if (needsPayment) {
      const settings = await getSettings();
      const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const payment = await requestPayment({
        amountToman: dueNow,
        description: `رزرو ${service.title} — ${settings.clinicName}`,
        callbackUrl: `${base}/payment/callback`,
        mobile: customer.phone,
        email: customer.email ?? undefined,
      });

      if (!payment.ok) {
        // نوبت را آزاد می‌کنیم تا اسلات بلوکه نماند
        await prisma.appointment.delete({ where: { id: appointment.id } }).catch(() => undefined);
        return { ok: false, message: `اتصال به درگاه پرداخت ممکن نشد: ${payment.message}` };
      }

      await prisma.payment.create({
        data: {
          customerId: customer.id,
          appointmentId: appointment.id,
          amount: dueNow,
          method: "ONLINE",
          status: "PENDING",
          gateway: "zarinpal",
          authority: payment.authority,
          note: "بیعانه‌ی رزرو نوبت",
        },
      });

      return { ok: true, redirectTo: payment.redirectUrl };
    }

    // بدون بیعانه: نوبت مستقیم ثبت و پیامک ارسال می‌شود
    const customerName = `${customer.firstName} ${customer.lastName}`;
    await notifyBookingCreated({
      phone: customer.phone,
      customerName,
      serviceTitle: service.title,
      startsAt,
      code: appointment.code,
    }).catch(() => undefined);

    if (customer.email) {
      await notifyBookingEmail({
        email: customer.email,
        customerName,
        serviceTitle: service.title,
        startsAt,
        code: appointment.code,
      }).catch(() => undefined);
    }

    return {
      ok: true,
      code: appointment.code,
      summary: `${service.title} — ${formatJalaliDateTime(startsAt)}`,
      loggedIn: !!session || isNewCustomer,
    };
  } catch {
    return { ok: false, message: "ثبت نوبت با خطا مواجه شد. لطفاً دوباره تلاش کنید." };
  }
}

/**
 * وقتی خدمتی بیعانه ندارد ولی به‌خاطر بدقولیِ مکرر باید بگیریم.
 * از درصد عمومی استفاده می‌کنیم؛ اگر قیمتی هم نبود، یک مبلغ حداقلی.
 */
async function fallbackDeposit(service: { priceFrom: number | null }): Promise<number> {
  const settings = await getSettings();
  const percent = Number(settings.depositPercent) || 0;
  if (percent > 0 && service.priceFrom) {
    return Math.round((service.priceFrom * percent) / 100);
  }
  return 100_000;
}

/** مبلغ بیعانه‌ی یک خدمت: مقدار اختصاصی، وگرنه درصد عمومی از قیمت پایه */
export async function depositFor(serviceId: string): Promise<number> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { depositAmount: true, priceFrom: true },
  });
  if (!service) return 0;
  if (service.depositAmount !== null) return service.depositAmount;

  const settings = await getSettings();
  const percent = Number(settings.depositPercent) || 0;
  if (!percent || !service.priceFrom) return 0;
  return Math.round((service.priceFrom * percent) / 100);
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
