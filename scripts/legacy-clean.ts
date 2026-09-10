/**
 * ───────────────────────────────────────────────────────────────
 *  قانون‌های پاک‌سازی داده‌ی برنامه‌ی قدیمی
 * ───────────────────────────────────────────────────────────────
 *
 *  برنامه‌ی قدیمی چند اشکال سیستماتیک داشت که در داده‌ها رد گذاشته‌اند.
 *  هر قانون اینجا بر اساس شواهدِ خودِ داده نوشته شده، نه حدس، و هر تبدیل
 *  علتش را برمی‌گرداند تا در گزارش برای مدیر قابل توضیح باشد.
 *
 *  این فایل عمداً هیچ وابستگی‌ای به دیتابیس ندارد تا بشود تستش کرد.
 */

import { normalizeName, normalizePhone, toEn } from "../src/lib/utils";

export { normalizeName };

// ─── تلفن ────────────────────────────────────────────────────────

export type PhoneKind = "mobile" | "landline" | "invalid";

export type CleanPhone = {
  value: string;
  kind: PhoneKind;
  /** اگر چیزی عوض شده، این می‌گوید چه و چرا */
  note: string | null;
};

/**
 * شماره‌ی برنامه‌ی قدیمی را قابل استفاده می‌کند.
 *
 * چیزهایی که در داده‌ی واقعی دیده شد: ستاره وسط شماره («۰*۹۳۷۵۱۸۵۵۶۵»)،
 * فاصله‌ی ابتدای شماره، شماره‌ی ثابت هشت‌رقمی به‌جای موبایل، شماره‌ی ناقص
 * («۰۹۳۶») و رشته‌ی «۰».
 */
export function cleanPhone(raw: string | null | undefined): CleanPhone {
  const original = String(raw ?? "");
  // فقط رقم‌ها می‌مانند؛ هر چیز دیگری (ستاره، فاصله، خط تیره) اشتباه تایپ بوده
  const digits = toEn(original).replace(/\D/g, "");
  const junk = digits !== toEn(original).trim();

  if (!digits || digits === "0") {
    return { value: "", kind: "invalid", note: "شماره‌ای ثبت نشده بود" };
  }

  const mobile = normalizePhone(digits);
  if (/^09\d{9}$/.test(mobile)) {
    return {
      value: mobile,
      kind: "mobile",
      note: junk ? `از «${original.trim()}» پاک شد` : null,
    };
  }

  // هرچه با ۰۹ شروع شود موبایل است؛ اگر به ۱۱ رقم نرسیده، ناقص تایپ شده
  // و قابل بازیابی نیست — نباید با شماره‌ی ثابت اشتباه گرفته شود
  if (digits.startsWith("09") || digits.startsWith("9")) {
    return { value: digits, kind: "invalid", note: `موبایل ناقص («${original.trim()}»)` };
  }

  // ثابت: با کد شهر یازده‌رقمی («۰۲۱...»)، بدون کد شهر هشت‌رقمی
  if (/^0[1-8]\d{9}$/.test(digits) || /^[1-9]\d{7}$/.test(digits)) {
    return { value: digits, kind: "landline", note: `شماره‌ی ثابت («${original.trim()}»)` };
  }

  return { value: digits, kind: "invalid", note: `شماره‌ی نامعتبر («${original.trim()}»)` };
}

// ─── تاریخ ───────────────────────────────────────────────────────

export type CleanDate = {
  value: Date | null;
  note: string | null;
};

/** روزهای هر ماه شمسی — سال کبیسه اینجا مهم نیست چون فقط تبدیل می‌کنیم */
function jalaliToGregorian(jy: number, jm: number, jd: number): Date | null {
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  // الگوریتم استاندارد تبدیل تقویم جلالی به میلادی
  let gy = jy <= 979 ? 621 : 1600;
  const jy2 = jy <= 979 ? jy : jy - 979;
  let days =
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > monthDays[gm]; gm++) gd -= monthDays[gm];

  const out = new Date(Date.UTC(gy, gm - 1, gd));
  return Number.isNaN(out.getTime()) ? null : out;
}

/**
 * تاریخ‌های برنامه‌ی قدیمی سه‌جور خراب‌اند و هر سه از یک باگ می‌آیند:
 * دکمه‌ی تبدیل تاریخ، هرچه در کادر سال بود را «شمسی» فرض می‌کرد و تبدیل
 * می‌کرد — حتی وقتی از قبل میلادی بود.
 *
 *  • سال ۱۳۸۰ تا ۱۴۵۰ → شمسیِ خام است، باید تبدیل شود.
 *  • سال ۲۶۰۰ تا ۲۷۰۰ → میلادیِ دوباره‌تبدیل‌شده است (۲۰۲۲ ← ۲۶۴۳)، ۶۲۱ سال کم.
 *  • سال ۹۰۰ تا ۱۱۰۰ → سالِ دورقمی/سه‌رقمی که تبدیل شده («۴۰۱» ← ۱۰۲۲).
 *  • هر چیز دیگرِ بیرون از بازه‌ی منطقی → غیرقابل بازیابی.
 */
export function cleanDate(raw: Date | null | undefined, now = new Date()): CleanDate {
  if (!raw || Number.isNaN(raw.getTime())) return { value: null, note: "تاریخ نداشت" };

  const y = raw.getFullYear();
  const time = {
    h: raw.getHours(),
    m: raw.getMinutes(),
  };
  const withTime = (d: Date | null, note: string): CleanDate => {
    if (!d) return { value: null, note: "تاریخ قابل بازیابی نبود" };
    d.setHours(time.h, time.m, 0, 0);
    return { value: d, note };
  };

  // سال منطقی: از افتتاح کلینیک تا امروز، با کمی حاشیه برای نوبت‌های آینده
  const maxYear = now.getFullYear() + 2;
  if (y >= 2000 && y <= maxYear) return { value: raw, note: null };

  if (y >= 1380 && y <= 1450) {
    const g = jalaliToGregorian(y, raw.getMonth() + 1, raw.getDate());
    return withTime(g, `تاریخ شمسی خام «${y}/${raw.getMonth() + 1}/${raw.getDate()}» بود`);
  }

  if (y >= 2600 && y <= 2700) {
    const fixed = new Date(raw);
    fixed.setFullYear(y - 621);
    return { value: fixed, note: `سال ${y} دوبار تبدیل شده بود؛ ${y - 621} درست است` };
  }

  if (y >= 900 && y <= 1100) {
    // «۴۰۱» تایپ شده، تبدیل شده به ۱۰۲۲؛ برمی‌گردانیم به ۱۴۰۱ شمسی
    const shortJy = y - 621;
    if (shortJy >= 300 && shortJy <= 450) {
      const g = jalaliToGregorian(1000 + shortJy, raw.getMonth() + 1, raw.getDate());
      return withTime(g, `سال «${shortJy}» ناقص تایپ شده بود؛ ${1000 + shortJy} شمسی درست است`);
    }
  }

  return { value: null, note: `سال ${y} بی‌معنی است` };
}

// ─── مبلغ ────────────────────────────────────────────────────────

/**
 * زیر این عدد، مبلغ را «هزار تومان» می‌شماریم.
 *
 * شاهد: پرتکرارترین مبالغِ زیر ۱۰۰۰ دقیقاً همان پرتکرارترین مبالغِ بالای
 * ۱۰۰٬۰۰۰ تقسیم بر هزارند (۴۵۰ و ۴۵۰٬۰۰۰، ۳۵۰ و ۳۵۰٬۰۰۰، ...). یعنی منشی
 * گاهی «۴۵۰» می‌نوشته و منظورش ۴۵۰ هزار تومان بوده.
 */
export const THOUSANDS_THRESHOLD = 1000;

export type CleanAmount = { value: number; note: string | null };

export function cleanAmount(raw: number | null | undefined): CleanAmount {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n <= 0) return { value: 0, note: null };
  if (n < THOUSANDS_THRESHOLD) {
    return { value: n * 1000, note: `در برنامه‌ی قدیمی «${n}» ثبت شده بود (هزار تومان)` };
  }
  return { value: n, note: null };
}

// ─── نام ─────────────────────────────────────────────────────────

/** کلیدِ «این همان آدم است»: شماره‌ی نرمال‌شده + نام نرمال‌شده */
export function identityKey(phone: string, first: string, last: string): string {
  return `${phone}|${normalizeName(`${first} ${last}`)}`;
}

/** فاصله‌ی اضافه و نیم‌فاصله‌ی بی‌جا را از نامِ نمایشی می‌گیرد */
export function tidyName(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}
