import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** اعداد انگلیسی را به ارقام فارسی تبدیل می‌کند */
export function toFa(input: string | number): string {
  const digits = "۰۱۲۳۴۵۶۷۸۹";
  return String(input).replace(/\d/g, (d) => digits[Number(d)]);
}

/** ارقام فارسی/عربی را به انگلیسی برمی‌گرداند (برای ورودی فرم‌ها) */
export function toEn(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** ۲۵۰۰۰۰ → «۲۵۰,۰۰۰ تومان» */
/**
 * مبلغ را به تومان با ارقام فارسی نمایش می‌دهد.
 * صفر یعنی «۰ تومان» — مفهوم «رایگان» فقط برای قیمت خدمات معنی دارد
 * و در formatPriceRange مدیریت می‌شود، نه در جمع مالی.
 */
export function formatToman(amount: number | null | undefined, withUnit = true): string {
  if (amount === null || amount === undefined) return "تماس بگیرید";
  // «٬» جداکننده‌ی هزارگان فارسی است، نه ویرگول لاتین
  const formatted = toFa(amount.toLocaleString("en-US")).replace(/,/g, "٬");
  return withUnit ? `${formatted} تومان` : formatted;
}

/** بازه‌ی قیمت خدمت */
export function formatPriceRange(from?: number | null, to?: number | null): string {
  const hasFrom = from !== null && from !== undefined;
  const hasTo = to !== null && to !== undefined;

  if (!hasFrom && !hasTo) return "استعلام قیمت";
  if (from === 0 && !hasTo) return "رایگان";
  if (hasFrom && hasTo && from !== to) return `از ${formatToman(from, false)} تا ${formatToman(to)}`;
  return formatToman(hasFrom ? from : to);
}

/** ۹۰ → «۱ ساعت و ۳۰ دقیقه» */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
  if (h) return `${toFa(h)} ساعت`;
  return `${toFa(m)} دقیقه`;
}

/** نگاشت حروف فارسی/عربی به لاتین برای ساخت نشانی خوانا */
const TRANSLITERATION: Record<string, string> = {
  "آ": "a", "ا": "a", "أ": "a", "إ": "e", "ب": "b", "پ": "p", "ت": "t", "ث": "s",
  "ج": "j", "چ": "ch", "ح": "h", "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z",
  "ژ": "zh", "س": "s", "ش": "sh", "ص": "s", "ض": "z", "ط": "t", "ظ": "z", "ع": "a",
  "غ": "gh", "ف": "f", "ق": "gh", "ک": "k", "ك": "k", "گ": "g", "ل": "l", "م": "m",
  "ن": "n", "و": "v", "ؤ": "o", "ه": "h", "ة": "h", "ی": "i", "ي": "i", "ئ": "i",
  // همزه و اعراب حذف می‌شوند
  "ء": "", "\u064B": "", "\u064C": "", "\u064D": "", "\u064E": "",
  "\u064F": "", "\u0650": "", "\u0651": "", "\u0652": "",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

/**
 * نشانی (slug) لاتین و امن برای URL می‌سازد.
 * حروف فارسی به معادل لاتین تبدیل می‌شوند تا آدرس صفحه در همه‌ی
 * مرورگرها، پیامک‌ها و شبکه‌های اجتماعی درست کار کند.
 */
export function slugify(input: string): string {
  const transliterated = [...input.trim().toLowerCase()]
    .map((char) => (char in TRANSLITERATION ? TRANSLITERATION[char] : char))
    .join("");

  return transliterated
    .replace(/[\s‌_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/** شماره موبایل ایران را نرمال می‌کند: 09121234567 */
export function normalizePhone(raw: string): string {
  let p = toEn(raw).replace(/[\s()-]/g, "");
  if (p.startsWith("+98")) p = "0" + p.slice(3);
  else if (p.startsWith("0098")) p = "0" + p.slice(4);
  else if (p.startsWith("98") && p.length === 12) p = "0" + p.slice(2);
  else if (p.startsWith("9") && p.length === 10) p = "0" + p;
  return p;
}

/**
 * نام فارسی را برای «آیا این همان آدم است؟» یکدست می‌کند.
 *
 * سه چیز باعث می‌شود دو نوشتنِ یک نام برابر شمرده نشوند: عربی‌نویسیِ ی و ک،
 * نیم‌فاصله، و فاصله‌ی اضافه («آزادمنجیری» و «آزاد منجیری»). هر سه اینجا
 * برداشته می‌شوند. اعراب هم حذف می‌شود چون گاهی تایپ می‌شود و گاهی نه.
 *
 * فقط برای مقایسه است؛ چیزی که ذخیره یا نمایش داده می‌شود همان نوشته‌ی اصلی است.
 */
export function normalizeName(raw: string): string {
  return (raw ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "") // اعراب
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/[\s\u200c\u200f\u200e]+/g, "") // فاصله، نیم‌فاصله و نشانه‌های جهت
    .trim()
    .toLowerCase();
}

export function isValidIranMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(raw));
}

/** کد پیگیری خوانا برای نوبت — مثل SH-7K3M9 */
export function generateBookingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `SH-${out}`;
}

export function truncate(text: string, max = 140): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/** تخمین زمان مطالعه بر اساس تعداد کلمات فارسی */
export function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * نشانی آمده از URL را برای جستجو در دیتابیس آماده می‌کند.
 * محتوای قدیمی ممکن است نشانی غیرلاتین داشته باشد که مرورگر آن را
 * درصدی (percent-encoded) می‌فرستد.
 */
export function decodeSlug(slug: string): string[] {
  const variants = new Set([slug]);
  try {
    variants.add(decodeURIComponent(slug));
  } catch {
    // نشانی حاوی درصدِ نامعتبر — همان مقدار خام کافی است
  }
  return [...variants];
}
