import { cache } from "react";
import { prisma } from "./prisma";

/** تنظیمات پیش‌فرض سایت — اگر در دیتابیس نبود همین‌ها استفاده می‌شود */
export const DEFAULT_SETTINGS = {
  clinicName: "کلینیک زیبایی شهرزاد",
  tagline: "زیبایی، با دستان امن متخصص",
  description:
    "کلینیک تخصصی پوست، مو و زیبایی شهرزاد با بیش از ۱۵ سال سابقه، جدیدترین دستگاه‌های روز دنیا و کادری کاملاً حرفه‌ای، همراه شماست.",
  phone: "021-88776655",
  mobile: "0912-3456789",
  whatsapp: "989123456789",
  email: "info@sharzadclinic.ir",
  address: "تهران، خیابان ولیعصر، بالاتر از پارک‌وی، برج نگین، طبقه ۵، واحد ۱۲",
  instagram: "https://instagram.com/sharzadclinic",
  telegram: "https://t.me/sharzadclinic",
  mapLat: "35.7896",
  mapLng: "51.4152",
  establishedYear: "1388",
  bookingLeadHours: "3",
  bookingHorizonDays: "45",
  slotStepMinutes: "30",
  /** درصد بیعانه‌ی آنلاین از قیمت پایه‌ی خدمت */
  depositPercent: "30",
  /** پس از چند روز از آخرین جلسه، پیگیری جلسه‌ی بعدی ساخته شود */
  followUpAfterDays: "28",
  /** پس از «انجام‌شده» شدن نوبت، پیامک نظرسنجی خودکار برود؟ "1" یا "0" */
  feedbackAutoSms: "1",
  /** شماره‌ی مدیر برای گزارش شبانه. خالی یعنی از شماره‌ی موبایل کلینیک */
  managerPhone: "",
  /** گزارش شبانه‌ی پیامکی فعال باشد؟ "1" یا "0" */
  dailyDigestSms: "1",
  /** پیامک تبریک تولد فعال باشد؟ "1" یا "0" */
  birthdaySms: "0",
  /** کد تخفیفی که در پیامک تولد معرفی می‌شود — خالی یعنی فقط تبریک */
  birthdayDiscountCode: "",
  /** پیامک خودکار «حالتان چطور است؟» پس از درمان — "1" یا "0" */
  postCareSms: "0",
  /** پس از چند ماه نیامدن، مشتری در فهرست بازگردانی بیاید */
  winBackAfterMonths: "6",
  /** پیامک خودکار بازگردانی مشتری غایب — "1" یا "0" */
  winBackSms: "0",
  /** کد تخفیفی که در پیامک بازگردانی معرفی می‌شود */
  winBackDiscountCode: "",
  /** سیستم «کد معرف» فعال باشد؟ "1" یا "0" */
  referralEnabled: "0",
  /** هدیه‌ی معرف، به تومان — وقتی معرفی‌شده اولین جلسه‌اش را انجام داد */
  referrerReward: "200000",
  /** هدیه‌ی معرفی‌شده، به تومان */
  referredReward: "200000",
  /** هدیه‌ها چند روز اعتبار دارند */
  referralRewardDays: "90",
} as const;

export type SettingsMap = Record<string, string>;

export const getSettings = cache(async (): Promise<SettingsMap> => {
  try {
    const rows = await prisma.setting.findMany();
    const fromDb = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULT_SETTINGS, ...fromDb };
  } catch {
    // اگر دیتابیس هنوز آماده نیست سایت نباید بیفتد
    return { ...DEFAULT_SETTINGS };
  }
});

export async function getSetting(key: keyof typeof DEFAULT_SETTINGS | string): Promise<string> {
  const settings = await getSettings();
  return settings[key] ?? "";
}

export async function setSettings(values: SettingsMap): Promise<void> {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    )
  );
}
