import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDay,
  getDaysInMonth,
  getMonth,
  getYear,
  isSameDay,
  newDate,
  startOfDay,
  startOfMonth,
} from "date-fns-jalali";
import { faIR } from "date-fns-jalali/locale";
import { toFa } from "./utils";

/** هفته‌ی ایرانی از شنبه شروع می‌شود */
export const WEEKDAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;
export const WEEKDAYS_SHORT_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;
export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
] as const;

/** شماره‌ی روز هفته با مبنای شنبه = ۰ (getDay استاندارد یکشنبه = ۰ می‌دهد) */
export function jalaliWeekday(date: Date): number {
  return (getDay(date) + 1) % 7;
}

export function formatJalali(date: Date, pattern = "yyyy/MM/dd"): string {
  return toFa(format(date, pattern, { locale: faIR }));
}

/** «۱۰ شهریور ۱۴۰۵» */
export function formatJalaliLong(date: Date): string {
  return toFa(format(date, "d MMMM yyyy", { locale: faIR }));
}

/** «شنبه، ۱۰ شهریور» */
export function formatJalaliWithWeekday(date: Date): string {
  return `${WEEKDAYS_FA[jalaliWeekday(date)]}، ${toFa(format(date, "d MMMM", { locale: faIR }))}`;
}

/** «۱۴:۳۰» با ارقام فارسی */
export function formatTime(date: Date): string {
  return toFa(format(date, "HH:mm"));
}

export function formatJalaliDateTime(date: Date): string {
  return `${formatJalaliLong(date)} ساعت ${formatTime(date)}`;
}

/** کلید تاریخ میلادی برای رد و بدل با API — «2026-09-01» */
export function ymdKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** «2026-09-01» → نیمه‌شب همان روز به وقت محلی سرور (تهران) */
export function parseYmdKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** «09:30» را روی یک روز مشخص می‌نشاند */
export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const out = new Date(day);
  out.setHours(h, m, 0, 0);
  return out;
}

export function minutesFromHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hhmmFromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type CalendarCell = {
  /** تاریخ میلادی متناظر */
  date: Date;
  key: string;
  /** روز شمسی */
  jDay: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
};

/**
 * شبکه‌ی ۶×۷ یک ماه شمسی را می‌سازد (شنبه تا جمعه).
 * `offsetMonths` نسبت به ماه جاری جابه‌جا می‌شود.
 */
export function jalaliMonthGrid(offsetMonths = 0, reference = new Date()): {
  cells: CalendarCell[];
  monthLabel: string;
  jYear: number;
  jMonth: number;
} {
  const anchor = addMonths(reference, offsetMonths);
  const first = startOfMonth(anchor);
  const jYear = getYear(anchor);
  const jMonth = getMonth(anchor); // ۰-based
  const daysInMonth = getDaysInMonth(anchor);
  const leading = jalaliWeekday(first);

  const today = startOfDay(new Date());
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const date = addDays(first, i - leading);
    const inCurrentMonth = i >= leading && i < leading + daysInMonth;
    cells.push({
      date,
      key: ymdKey(date),
      jDay: Number(format(date, "d")),
      inCurrentMonth,
      isToday: isSameDay(date, today),
      isPast: startOfDay(date) < today,
    });
  }

  return {
    cells,
    monthLabel: `${JALALI_MONTHS[jMonth]} ${toFa(jYear)}`,
    jYear,
    jMonth,
  };
}

/** ساخت تاریخ میلادی از اجزای شمسی */
export function fromJalali(jy: number, jm: number, jd: number): Date {
  return newDate(jy, jm - 1, jd);
}

/**
 * بازه‌ی یک ماه شمسی. offset صفر یعنی ماه جاری، ۱- یعنی ماه قبل.
 * برای دوره‌های حقوقی استفاده می‌شود.
 */
export function jalaliMonthRange(offsetMonths = 0): {
  from: Date;
  to: Date;
  label: string;
  key: string;
} {
  const anchor = addMonths(new Date(), offsetMonths);
  const from = startOfMonth(anchor);
  from.setHours(0, 0, 0, 0);

  const to = endOfMonth(anchor);
  to.setHours(23, 59, 59, 999);

  const jMonth = getMonth(anchor);
  const jYear = getYear(anchor);

  return {
    from,
    to,
    label: `${JALALI_MONTHS[jMonth]} ${toFa(jYear)}`,
    key: `${jYear}-${String(jMonth + 1).padStart(2, "0")}`,
  };
}

/** «۳ روز پیش» */
export function timeAgoFa(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "همین الان";
  if (min < 60) return `${toFa(min)} دقیقه پیش`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${toFa(h)} ساعت پیش`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${toFa(d)} روز پیش`;
  return formatJalaliLong(date);
}

export { addDays, addMonths, endOfMonth, startOfDay, startOfMonth, isSameDay };
