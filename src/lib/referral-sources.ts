/**
 * «از کجا با ما آشنا شدید؟»
 *
 * بدون این، تبلیغات کلینیک حدس است. با این، مدیر می‌بیند هر کانال چند
 * مشتری و چقدر درآمد آورده و پولش را کجا خرج کند.
 *
 * فهرست عمداً کوتاه است — گزینه‌ی زیاد یعنی هیچ‌کس جواب نمی‌دهد.
 */
export const REFERRAL_SOURCES = [
  { key: "instagram", label: "اینستاگرام" },
  { key: "friend", label: "معرفی دوست یا آشنا" },
  { key: "google", label: "جستجو در گوگل" },
  { key: "passing", label: "تابلوی کلینیک / رد می‌شدم" },
  { key: "ads", label: "تبلیغات (بنر، بروشور، تراکت)" },
  { key: "returning", label: "قبلاً مشتری بوده‌ام" },
  { key: "other", label: "جای دیگر" },
] as const;

export type ReferralSourceKey = (typeof REFERRAL_SOURCES)[number]["key"];

const KEYS = new Set<string>(REFERRAL_SOURCES.map((s) => s.key));

export function isReferralSource(value: string | null | undefined): value is ReferralSourceKey {
  return !!value && KEYS.has(value);
}

/** مقدار معتبر یا null — تا چیزی که از فرم می‌آید کورکورانه ذخیره نشود */
export function normalizeSource(value: string | null | undefined): ReferralSourceKey | null {
  return isReferralSource(value) ? value : null;
}

export function sourceLabel(key: string | null | undefined): string {
  if (!key) return "نامشخص";
  return REFERRAL_SOURCES.find((s) => s.key === key)?.label ?? key;
}
