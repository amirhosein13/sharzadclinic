import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { listBackups } from "./backup";
import { isZarinpalConfigured } from "./zarinpal";
import { unclosedDays } from "./cash";
import { formatJalaliDateTime } from "./date";
import { toFa } from "./utils";

/**
 * «سلامت سیستم» — نسخه‌ی قابل‌دیدنِ `npm run doctor` برای مدیر.
 *
 * هر مورد به زبان آدمیزاد می‌گوید چه چیزی درست نیست و چه اتفاقی می‌افتد
 * اگر درستش نکنیم؛ نه فقط «خطا».
 */

export type HealthLevel = "ok" | "warn" | "bad";

export type HealthCheck = {
  key: string;
  title: string;
  level: HealthLevel;
  /** وضعیت فعلی، کوتاه */
  detail: string;
  /** اگر مشکلی هست: چه اتفاقی می‌افتد و چه باید کرد */
  impact?: string;
  href?: string;
};

export type HealthGroup = { title: string; checks: HealthCheck[] };

export type HealthReport = {
  groups: HealthGroup[];
  bad: number;
  warn: number;
  checkedAt: Date;
};

export async function buildHealth(): Promise<HealthReport> {
  const settings = await getSettings();
  const now = new Date();

  /* ── پیامک ─────────────────────────────────────────────── */
  const provider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const isMeli = provider === "melipayamak" || provider === "meli";
  const smsReady = isMeli
    ? !!process.env.MELIPAYAMAK_USERNAME && !!process.env.MELIPAYAMAK_PASSWORD
    : provider === "kavenegar" && !!process.env.KAVENEGAR_API_KEY;

  const services: HealthCheck[] = [
    {
      key: "sms",
      title: "پنل پیامک",
      level: smsReady ? "ok" : "bad",
      detail: smsReady
        ? `${isMeli ? "ملی پیامک" : "کاوه‌نگار"} وصل است`
        : `حالت «${provider}» — پیامک واقعی ارسال نمی‌شود`,
      impact: smsReady
        ? undefined
        : "مشتری نمی‌تواند وارد حسابش شود، یادآوری نوبت نمی‌رود و نظرسنجی و هدیه‌ها ارسال نمی‌شوند.",
      href: "/admin/notifications",
    },
  ];

  if (smsReady && isMeli) {
    services.push({
      key: "sms-sender",
      title: "شماره‌ی فرستنده‌ی پیامک",
      level: process.env.MELIPAYAMAK_SENDER ? "ok" : "bad",
      detail: process.env.MELIPAYAMAK_SENDER ? "تنظیم شده" : "MELIPAYAMAK_SENDER خالی است",
      impact: process.env.MELIPAYAMAK_SENDER
        ? undefined
        : "پیامک‌های عادی (یادآوری، تبریک، گروهی) ارسال نمی‌شوند.",
    });
    services.push({
      key: "sms-otp",
      title: "الگوی کد ورود",
      level: process.env.MELIPAYAMAK_OTP_BODY_ID ? "ok" : "bad",
      detail: process.env.MELIPAYAMAK_OTP_BODY_ID ? "تنظیم شده" : "MELIPAYAMAK_OTP_BODY_ID خالی است",
      impact: process.env.MELIPAYAMAK_OTP_BODY_ID
        ? undefined
        : "کد ورود مشتری ارسال نمی‌شود و هیچ‌کس نمی‌تواند وارد حسابش شود.",
    });
  }

  services.push({
    key: "gateway",
    title: "درگاه پرداخت",
    level: isZarinpalConfigured() ? "ok" : "warn",
    detail: isZarinpalConfigured() ? "زرین‌پال تنظیم شده است" : "تنظیم نشده",
    impact: isZarinpalConfigured()
      ? undefined
      : "بیعانه‌ی آنلاین گرفته نمی‌شود. اگر نمی‌خواهید آنلاین پول بگیرید، اشکالی ندارد.",
  });

  services.push({
    key: "email",
    title: "ایمیل",
    level: process.env.SMTP_HOST ? "ok" : "warn",
    detail: process.env.SMTP_HOST ? "تنظیم شده است" : "تنظیم نشده",
    impact: process.env.SMTP_HOST ? undefined : "ایمیل تأیید نوبت فرستاده نمی‌شود. اختیاری است.",
  });

  /* ── پشتیبان ───────────────────────────────────────────── */
  const backups = await listBackups();
  const last = backups[0];
  const ageDays = last
    ? Math.floor((now.getTime() - last.createdAt.getTime()) / 86_400_000)
    : null;

  const safety: HealthCheck[] = [
    {
      key: "backup",
      title: "نسخه‌ی پشتیبان",
      level: ageDays === null ? "bad" : ageDays >= 3 ? "bad" : ageDays >= 2 ? "warn" : "ok",
      detail:
        ageDays === null
          ? "هیچ نسخه‌ای گرفته نشده"
          : `آخرین نسخه ${formatJalaliDateTime(last!.createdAt)}`,
      impact:
        ageDays === null || ageDays >= 2
          ? "پرونده‌های پزشکی قابل بازسازی نیستند. یک نسخه بگیرید و روی گوشی‌تان نگه دارید."
          : undefined,
      href: "/admin/backup",
    },
  ];

  const recovery = await prisma.user.count({ where: { isActive: true, phone: { not: null } } });
  safety.push({
    key: "recovery",
    title: "راه بازیابی رمز پنل",
    level: recovery > 0 ? "ok" : "bad",
    detail:
      recovery > 0
        ? `${toFa(recovery)} حساب موبایل دارد`
        : "هیچ حساب پنلی موبایل ثبت‌شده ندارد",
    impact:
      recovery > 0
        ? undefined
        : "اگر رمز فراموش شود، هیچ راه بازگشتی از خود سایت نیست و باید از روی سرور رمز عوض شود.",
    href: "/admin/users",
  });

  /* ── نوبت‌دهی ──────────────────────────────────────────── */
  const [openDays, bookableServices, activeStaff, orphanServices] = await Promise.all([
    prisma.workingHour.count({ where: { isOpen: true } }),
    prisma.service.count({ where: { isActive: true, isBookable: true } }),
    prisma.staff.count({
      where: { isActive: true, acceptsBookings: true, schedules: { some: { isActive: true } } },
    }),
    prisma.service.count({
      where: {
        isActive: true,
        isBookable: true,
        staff: { none: { staff: { isActive: true, schedules: { some: { isActive: true } } } } },
      },
    }),
  ]);

  const booking: HealthCheck[] = [
    {
      key: "hours",
      title: "ساعات کاری",
      level: openDays > 0 ? "ok" : "bad",
      detail: openDays > 0 ? `${toFa(openDays)} روز هفته باز است` : "هیچ روزی باز نیست",
      impact: openDays > 0 ? undefined : "رزرو آنلاین برای هیچ روزی وقت نشان نمی‌دهد.",
      href: "/admin/settings",
    },
    {
      key: "staff",
      title: "پرسنل با برنامه‌ی هفتگی",
      level: activeStaff > 0 ? "ok" : "bad",
      detail: activeStaff > 0 ? `${toFa(activeStaff)} نفر` : "هیچ‌کس برنامه‌ی هفتگی ندارد",
      impact: activeStaff > 0 ? undefined : "رزرو آنلاین اصلاً وقت خالی پیدا نمی‌کند.",
      href: "/admin/staff",
    },
    {
      key: "orphan-services",
      title: "خدمات بدون پرسنل",
      level: orphanServices === 0 ? "ok" : "warn",
      detail:
        orphanServices === 0
          ? `همه‌ی ${toFa(bookableServices)} خدمتِ قابل رزرو پرسنل دارند`
          : `${toFa(orphanServices)} خدمت پرسنلِ آماده ندارد`,
      impact:
        orphanServices === 0
          ? undefined
          : "این خدمات همیشه می‌گویند «وقت خالی نیست» و مشتری فکر می‌کند کلینیک پر است.",
      href: "/admin/services",
    },
  ];

  /* ── کارهای روزمره ────────────────────────────────────── */
  const dayStart = new Date(now.getTime() - 86_400_000);
  const [failedSms, unclosed, staleAppointments] = await Promise.all([
    prisma.notificationLog.count({
      where: { channel: "SMS", status: "failed", createdAt: { gte: dayStart } },
    }),
    unclosedDays(14),
    prisma.appointment.count({
      where: { startsAt: { lt: dayStart }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
  ]);

  const daily: HealthCheck[] = [
    {
      key: "failed-sms",
      title: "پیامک‌های ناموفق ۲۴ ساعت اخیر",
      level: failedSms === 0 ? "ok" : failedSms > 5 ? "bad" : "warn",
      detail: failedSms === 0 ? "همه‌ی پیامک‌ها رفته‌اند" : `${toFa(failedSms)} پیامک نرفته`,
      impact:
        failedSms === 0
          ? undefined
          : "ممکن است شارژ پنل پیامک تمام شده باشد. گزارش ارسال‌ها را ببینید.",
      href: "/admin/notifications",
    },
    {
      key: "cash",
      title: "صندوق‌های بسته‌نشده",
      level: unclosed.length === 0 ? "ok" : unclosed.length > 3 ? "warn" : "ok",
      detail:
        unclosed.length === 0
          ? "همه‌ی روزها بسته شده‌اند"
          : `${toFa(unclosed.length)} روز بسته نشده`,
      impact:
        unclosed.length > 3
          ? "هرچه دیرتر بشمارید، یادآوردن اینکه پول کجا رفته سخت‌تر می‌شود."
          : undefined,
      href: "/admin/cash",
    },
    {
      key: "stale",
      title: "نوبت‌های بلاتکلیف",
      level: staleAppointments === 0 ? "ok" : staleAppointments > 10 ? "warn" : "ok",
      detail:
        staleAppointments === 0
          ? "همه‌ی نوبت‌های گذشته وضعیت دارند"
          : `${toFa(staleAppointments)} نوبت گذشته بدون وضعیت`,
      impact:
        staleAppointments > 10
          ? "تا «انجام شد» یا «نیامد» نخورند، گزارش درآمد و پورسانت پرسنل درست درنمی‌آید."
          : undefined,
      href: "/admin/appointments",
    },
  ];

  /* ── دیتابیس ──────────────────────────────────────────── */
  let dbLevel: HealthLevel = "ok";
  let dbDetail = "در دسترس است";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbLevel = "bad";
    dbDetail = "پاسخ نمی‌دهد";
  }

  const groups: HealthGroup[] = [
    { title: "سرویس‌های بیرونی", checks: services },
    { title: "امنیت و پشتیبان", checks: safety },
    { title: "نوبت‌دهی", checks: booking },
    { title: "کارهای روزمره", checks: daily },
    {
      title: "زیرساخت",
      checks: [
        { key: "db", title: "دیتابیس", level: dbLevel, detail: dbDetail },
        {
          key: "timezone",
          title: "منطقه‌ی زمانی",
          level: process.env.TZ === "Asia/Tehran" ? "ok" : "warn",
          detail: process.env.TZ ?? "تنظیم نشده",
          impact:
            process.env.TZ === "Asia/Tehran"
              ? undefined
              : "ساعت نوبت‌ها ممکن است با ساعت واقعی کلینیک نخواند.",
        },
        {
          key: "manager-phone",
          title: "شماره‌ی مدیر برای گزارش شبانه",
          level: settings.managerPhone?.trim() ? "ok" : "warn",
          detail: settings.managerPhone?.trim() ? "تنظیم شده" : "خالی است",
          impact: settings.managerPhone?.trim()
            ? undefined
            : "خلاصه‌ی هر شب به موبایل کلینیک می‌رود، نه موبایل شخصی مدیر.",
          href: "/admin/settings",
        },
      ],
    },
  ];

  const all = groups.flatMap((g) => g.checks);
  return {
    groups,
    bad: all.filter((c) => c.level === "bad").length,
    warn: all.filter((c) => c.level === "warn").length,
    checkedAt: now,
  };
}
