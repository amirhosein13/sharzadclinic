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
