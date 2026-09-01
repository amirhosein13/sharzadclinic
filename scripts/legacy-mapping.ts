/**
 * ───────────────────────────────────────────────────────────────
 *  نقشه‌ی مهاجرت از دیتابیس SQL Server اپلیکیشن قدیمی
 * ───────────────────────────────────────────────────────────────
 *
 *  ⚠️  این تنها فایلی است که باید ویرایش کنی.
 *
 *  مراحل:
 *   ۱. اول `npm run import:legacy -- --inspect` را بزن تا لیست جدول‌ها
 *      و ستون‌های دیتابیس قدیمی چاپ شود.
 *   ۲. بر اساس خروجی، نام جدول‌ها و ستون‌ها را در همین فایل اصلاح کن.
 *   ۳. `npm run import:legacy -- --dry-run` را بزن تا بدون نوشتن در
 *      دیتابیس، ببینی چه چیزی قرار است منتقل شود.
 *   ۴. در نهایت `npm run import:legacy` را اجرا کن.
 *
 *  مهاجرت idempotent است: هر رکورد با `legacyId` یکتا ثبت می‌شود،
 *  پس اجرای چندباره رکورد تکراری نمی‌سازد.
 */

export type LegacyMapping = {
  /** نام جدول در دیتابیس قدیمی */
  table: string;
  /** ستون کلید اصلی */
  idColumn: string;
  /** نگاشت ستون‌ها */
  columns: Record<string, string>;
};

/** جدول مشتریان/بیماران */
export const CUSTOMERS: LegacyMapping = {
  table: "Customers",
  idColumn: "CustomerID",
  columns: {
    firstName: "FirstName",
    lastName: "LastName",
    phone: "Mobile",
    email: "Email",
    nationalCode: "NationalCode",
    birthDate: "BirthDate",
    address: "Address",
    notes: "Description",
    gender: "Gender", // مقدار عددی/متنی — در normalizeGender پایین تبدیل می‌شود
    createdAt: "RegisterDate",
  },
};

/** جدول نوبت‌ها (اختیاری — اگر نداری این را null کن) */
export const APPOINTMENTS: LegacyMapping | null = {
  table: "Appointments",
  idColumn: "AppointmentID",
  columns: {
    customerLegacyId: "CustomerID",
    serviceLegacyId: "ServiceID",
    serviceTitle: "ServiceName", // اگر ID نداری، با نام خدمت تطبیق داده می‌شود
    startsAt: "AppointmentDate",
    durationMinutes: "Duration",
    status: "Status",
    note: "Description",
  },
};

/** جدول خدمات (اختیاری) */
export const SERVICES: LegacyMapping | null = {
  table: "Services",
  idColumn: "ServiceID",
  columns: {
    title: "ServiceName",
    price: "Price",
    durationMinutes: "Duration",
  },
};

/** جدول سوابق درمان / جلسات (اختیاری) */
export const TREATMENTS: LegacyMapping | null = {
  table: "Visits",
  idColumn: "VisitID",
  columns: {
    customerLegacyId: "CustomerID",
    serviceLegacyId: "ServiceID",
    performedAt: "VisitDate",
    sessionNo: "SessionNumber",
    description: "Description",
  },
};

/** جدول پرداخت‌ها (اختیاری) */
export const PAYMENTS: LegacyMapping | null = {
  table: "Payments",
  idColumn: "PaymentID",
  columns: {
    customerLegacyId: "CustomerID",
    amount: "Amount",
    paidAt: "PaymentDate",
    method: "PaymentType",
    reference: "TrackingCode",
    note: "Description",
  },
};

// ─── تبدیل‌کننده‌های مقدار ────────────────────────────────────────

/** جنسیت اپ قدیمی → enum جدید */
export function normalizeGender(raw: unknown): "FEMALE" | "MALE" | "OTHER" {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["0", "f", "female", "زن", "خانم", "مونث"].includes(value)) return "FEMALE";
  if (["1", "m", "male", "مرد", "آقا", "مذکر"].includes(value)) return "MALE";
  return "FEMALE"; // پیش‌فرض کلینیک زیبایی
}

/** وضعیت نوبت اپ قدیمی → enum جدید */
export function normalizeStatus(
  raw: unknown
): "PENDING" | "CONFIRMED" | "DONE" | "CANCELLED" | "NO_SHOW" {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["1", "confirmed", "تایید", "تأیید", "تاییدشده"].includes(value)) return "CONFIRMED";
  if (["2", "done", "completed", "انجام شد", "انجام‌شده", "تمام"].includes(value)) return "DONE";
  if (["3", "cancelled", "canceled", "لغو", "لغوشده"].includes(value)) return "CANCELLED";
  if (["4", "noshow", "no_show", "غیبت", "عدم مراجعه"].includes(value)) return "NO_SHOW";
  return "DONE"; // نوبت‌های قدیمی معمولاً گذشته‌اند
}

/** روش پرداخت اپ قدیمی → enum جدید */
export function normalizePaymentMethod(raw: unknown): "CASH" | "CARD" | "ONLINE" | "OTHER" {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["0", "cash", "نقد", "نقدی"].includes(value)) return "CASH";
  if (["1", "card", "pos", "کارت", "کارتخوان", "کارت‌خوان"].includes(value)) return "CARD";
  if (["2", "online", "آنلاین", "اینترنتی"].includes(value)) return "ONLINE";
  return "OTHER";
}

/**
 * مبلغ اپ قدیمی → تومان.
 * اگر اپ قدیمی مبالغ را «ریال» ذخیره می‌کرده، این را روی 10 بگذار.
 */
export const AMOUNT_DIVISOR = 1;
