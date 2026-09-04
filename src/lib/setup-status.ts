import "server-only";
import { prisma } from "./prisma";
import { getSettings, DEFAULT_SETTINGS } from "./settings";
import { listBackups } from "./backup";

export type SetupStep = {
  key: string;
  title: string;
  why: string;
  href: string;
  done: boolean;
  /** بدون این، بخشی از سایت اصلاً کار نمی‌کند */
  critical: boolean;
};

export type SetupStatus = {
  steps: SetupStep[];
  done: number;
  total: number;
  allDone: boolean;
};

/**
 * «چه کارهایی مانده تا کلینیک واقعاً راه بیفتد؟»
 *
 * هر گام از روی وضعیت واقعی دیتابیس یا تنظیمات چک می‌شود، نه از روی یک
 * تیک دستی — پس هیچ‌وقت دروغ نمی‌گوید.
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const settings = await getSettings();

  const [
    staffWithSchedule,
    servicesWithStaff,
    workingHours,
    consentTemplates,
    backups,
    realCustomers,
    usersWithPhone,
  ] = await Promise.all([
    prisma.staff.count({
      where: { isActive: true, acceptsBookings: true, schedules: { some: { isActive: true } } },
    }),
    prisma.service.count({
      where: {
        isActive: true,
        isBookable: true,
        staff: { some: { staff: { isActive: true, schedules: { some: { isActive: true } } } } },
      },
    }),
    prisma.workingHour.count({ where: { isOpen: true } }),
    prisma.consentTemplate.count({ where: { isActive: true } }),
    listBackups(),
    prisma.customer.count(),
    prisma.user.count({ where: { isActive: true, phone: { not: null } } }),
  ]);

  const smsProvider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const smsReady =
    (smsProvider === "melipayamak" || smsProvider === "meli"
      ? !!process.env.MELIPAYAMAK_USERNAME && !!process.env.MELIPAYAMAK_PASSWORD
      : smsProvider === "kavenegar" && !!process.env.KAVENEGAR_API_KEY);

  const steps: SetupStep[] = [
    {
      key: "clinic",
      title: "اطلاعات کلینیک را کامل کنید",
      why: "نام، تلفن و آدرس در همه‌ی صفحات سایت و پیامک‌ها استفاده می‌شود.",
      href: "/admin/settings",
      done: settings.clinicName !== DEFAULT_SETTINGS.clinicName || settings.phone !== DEFAULT_SETTINGS.phone,
      critical: false,
    },
    {
      key: "hours",
      title: "ساعات کاری کلینیک را تنظیم کنید",
      why: "روزهای تعطیل و ساعت باز و بسته‌شدن، مبنای نوبت‌دهی آنلاین است.",
      href: "/admin/settings",
      done: workingHours > 0,
      critical: true,
    },
    {
      key: "staff",
      title: "برنامه‌ی هفتگی پرسنل را وارد کنید",
      why: "پرسنلی که برنامه‌ی هفتگی ندارد، در رزرو آنلاین اصلاً وقت نشان نمی‌دهد.",
      href: "/admin/staff",
      done: staffWithSchedule > 0,
      critical: true,
    },
    {
      key: "services",
      title: "خدمات را به پرسنل وصل کنید",
      why: "خدمتی که پرسنلِ آماده ندارد، همیشه می‌گوید «وقت خالی نیست».",
      href: "/admin/services",
      done: servicesWithStaff > 0,
      critical: true,
    },
    {
      key: "sms",
      title: "پنل پیامک را وصل کنید",
      why: "بدون پیامک، مشتری نمی‌تواند وارد حسابش شود و یادآوری‌ها هم نمی‌روند.",
      href: "/admin/notifications",
      done: smsReady,
      critical: true,
    },
    {
      key: "consents",
      title: "متن رضایت‌نامه‌ها را بازنویسی کنید",
      why: "متن‌های نمونه با نظر مسئول فنی کلینیک باید جایگزین شوند.",
      href: "/admin/consents",
      done: consentTemplates > 0,
      critical: false,
    },
    {
      key: "manager",
      title: "شماره‌ی مدیر را برای گزارش شبانه بگذارید",
      why: "هر شب خلاصه‌ی روز به این شماره پیامک می‌شود.",
      href: "/admin/settings",
      done: !!settings.managerPhone?.trim(),
      critical: false,
    },
    {
      key: "recovery",
      title: "برای حساب‌های پنل موبایل ثبت کنید",
      why: "اگر رمز پنل فراموش شود، بدون موبایل هیچ راه بازگشتی از خود سایت نیست.",
      href: "/admin/users",
      done: usersWithPhone > 0,
      critical: true,
    },
    {
      key: "backup",
      title: "اولین نسخه‌ی پشتیبان را بگیرید",
      why: "پرونده‌های پزشکی قابل بازسازی نیستند. یک نسخه روی گوشی خودتان نگه دارید.",
      href: "/admin/backup",
      done: backups.length > 0,
      critical: true,
    },
  ];

  // اگر هنوز هیچ مشتری واقعی‌ای نیست، مهاجرت داده هم یک گام است
  if (realCustomers === 0) {
    steps.push({
      key: "customers",
      title: "مشتری‌ها را وارد کنید",
      why: "از پرونده‌های کاغذی یا اپلیکیشن قدیمی.",
      href: "/admin/customers",
      done: false,
      critical: false,
    });
  }

  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, allDone: done === steps.length };
}
