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
export function formatToman(amount: number | null | undefined, withUnit = true): string {
  if (amount === null || amount === undefined) return "تماس بگیرید";
  if (amount === 0) return "رایگان";
  // «٬» جداکننده‌ی هزارگان فارسی است، نه ویرگول لاتین
  const formatted = toFa(amount.toLocaleString("en-US")).replace(/,/g, "٬");
  return withUnit ? `${formatted} تومان` : formatted;
}

/** بازه‌ی قیمت خدمت */
export function formatPriceRange(from?: number | null, to?: number | null): string {
  if (from === 0 && !to) return "رایگان";
  if (from === null && to === null) return "استعلام قیمت";
  if (from === undefined && to === undefined) return "استعلام قیمت";
  if (from && to && from !== to) return `از ${formatToman(from, false)} تا ${formatToman(to)}`;
  return formatToman(from ?? to);
}

/** ۹۰ → «۱ ساعت و ۳۰ دقیقه» */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
  if (h) return `${toFa(h)} ساعت`;
  return `${toFa(m)} دقیقه`;
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s‌]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
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
