import { z } from "zod";
import { isValidIranMobile, normalizePhone, toEn } from "./utils";

const phoneSchema = z
  .string()
  .trim()
  .min(1, "شماره موبایل را وارد کنید")
  .transform(normalizePhone)
  .refine(isValidIranMobile, "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");

export const contactSchema = z.object({
  name: z.string().trim().min(2, "نام را وارد کنید").max(80),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.string().trim().email("ایمیل معتبر نیست")]).optional(),
  subject: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "متن پیام حداقل ۱۰ کاراکتر باشد").max(2000),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const bookingSchema = z.object({
  serviceId: z.string().min(1, "خدمت را انتخاب کنید"),
  staffId: z.string().optional().nullable(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را انتخاب کنید"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "ساعت را انتخاب کنید"),
  firstName: z.string().trim().min(2, "نام را وارد کنید").max(50),
  lastName: z.string().trim().min(2, "نام خانوادگی را وارد کنید").max(50),
  phone: phoneSchema,
  note: z.string().trim().max(500).optional(),
});
export type BookingInput = z.infer<typeof bookingSchema>;

export const trackSchema = z.object({
  code: z.string().trim().min(3, "کد پیگیری را وارد کنید").transform((v) => toEn(v).toUpperCase()),
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email("ایمیل معتبر نیست"),
  password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر است"),
});

export const testimonialSchema = z.object({
  authorName: z.string().trim().min(2, "نام را وارد کنید").max(60),
  serviceName: z.string().trim().max(80).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(15, "نظر شما حداقل ۱۵ کاراکتر باشد").max(1000),
});

/** خطاهای zod را به شکل { field: message } درمی‌آورد */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ─── فرم‌های پنل مدیریت ────────────────────────────────────────

/** عدد اختیاری که ورودی خالی را به null تبدیل می‌کند و ارقام فارسی را می‌پذیرد */
const optionalInt = z
  .union([z.literal(""), z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === "" || v === undefined || v === null) return null;
    const n = Number(toEn(String(v)));
    return Number.isFinite(n) ? Math.round(n) : null;
  });

const requiredInt = (min: number, max: number, message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => Number(toEn(String(v))))
    .refine((n) => Number.isFinite(n) && n >= min && n <= max, message);

export const serviceSchema = z.object({
  title: z.string().trim().min(2, "عنوان خدمت را وارد کنید").max(120),
  slug: z.string().trim().max(120).optional(),
  categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید"),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().trim().max(20000).optional(),
  image: z.string().trim().max(500).optional(),
  priceFrom: optionalInt,
  priceTo: optionalInt,
  durationMinutes: requiredInt(5, 600, "مدت جلسه باید بین ۵ تا ۶۰۰ دقیقه باشد"),
  bufferMinutes: requiredInt(0, 120, "بافر باید بین ۰ تا ۱۲۰ دقیقه باشد"),
  slotStepMinutes: optionalInt,
  depositAmount: optionalInt,
  sessionsNeeded: z.string().trim().max(120).optional(),
  preparation: z.string().trim().max(2000).optional(),
  aftercare: z.string().trim().max(2000).optional(),
  isFeatured: z.coerce.boolean().optional(),
  isBookable: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  order: optionalInt,
}).refine(
  (v) => v.priceFrom === null || v.priceTo === null || v.priceFrom <= v.priceTo,
  { message: "حداقل قیمت نمی‌تواند از حداکثر بیشتر باشد", path: ["priceFrom"] }
);

export const categorySchema = z.object({
  title: z.string().trim().min(2, "عنوان دسته‌بندی را وارد کنید").max(100),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(60).optional(),
  order: optionalInt,
  isActive: z.coerce.boolean().optional(),
});

export const staffSchema = z.object({
  name: z.string().trim().min(2, "نام پرسنل را وارد کنید").max(100),
  slug: z.string().trim().max(100).optional(),
  title: z.string().trim().min(2, "سمت را وارد کنید").max(120),
  bio: z.string().trim().max(2000).optional(),
  avatar: z.string().trim().max(500).optional(),
  licenseNo: z.string().trim().max(60).optional(),
  instagram: z.string().trim().max(200).optional(),
  baseSalary: optionalInt,
  commissionPercent: requiredInt(0, 100, "درصد پورسانت باید بین ۰ تا ۱۰۰ باشد"),
  order: optionalInt,
  isActive: z.coerce.boolean().optional(),
  acceptsBookings: z.coerce.boolean().optional(),
});

export const galleryItemSchema = z.object({
  title: z.string().trim().min(2, "عنوان نمونه‌کار را وارد کنید").max(150),
  description: z.string().trim().max(500).optional(),
  beforeImage: z.string().trim().min(1, "تصویر «قبل» الزامی است").max(500),
  afterImage: z.string().trim().max(500).optional(),
  serviceSlug: z.string().trim().max(120).optional(),
  order: optionalInt,
  isPublished: z.coerce.boolean().optional(),
});

export const postSchema = z.object({
  title: z.string().trim().min(3, "عنوان مقاله را وارد کنید").max(200),
  slug: z.string().trim().max(200).optional(),
  excerpt: z.string().trim().max(400).optional(),
  content: z.string().trim().min(20, "متن مقاله حداقل ۲۰ کاراکتر باشد").max(60000),
  coverImage: z.string().trim().max(500).optional(),
  categoryId: z.string().trim().optional(),
  isPublished: z.coerce.boolean().optional(),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(400).optional(),
});

export const staffScheduleSchema = z.object({
  staffId: z.string().min(1),
  weekday: requiredInt(0, 6, "روز هفته نامعتبر است"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "ساعت شروع نامعتبر است"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "ساعت پایان نامعتبر است"),
}).refine((v) => v.startTime < v.endTime, {
  message: "ساعت پایان باید بعد از ساعت شروع باشد",
  path: ["endTime"],
});

export const paymentSchema = z.object({
  appointmentId: z.string().min(1),
  amount: requiredInt(0, 1_000_000_000, "مبلغ نامعتبر است"),
  method: z.enum(["CASH", "CARD", "ONLINE", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "نام را وارد کنید").max(80),
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست"),
  role: z.enum(["ADMIN", "MANAGER", "RECEPTION", "OPERATOR"]),
  staffId: z.string().trim().optional(),
  password: z.union([z.literal(""), z.string().min(8, "رمز عبور حداقل ۸ کاراکتر باشد")]).optional(),
  isActive: z.coerce.boolean().optional(),
}).refine((v) => v.role !== "OPERATOR" || !!v.staffId, {
  message: "برای نقش اپراتور باید یکی از پرسنل انتخاب شود",
  path: ["staffId"],
});

/** تاریخ شمسی به شکل ۱۴۰۵/۰۶/۱۵ یا خالی */
const jalaliDate = z
  .union([z.literal(""), z.string()])
  .optional()
  .transform((v) => (v && v.trim() !== "" ? toEn(v.trim()) : null));

export const customerSchema = z.object({
  firstName: z.string().trim().min(2, "نام را وارد کنید").max(50),
  lastName: z.string().trim().min(2, "نام خانوادگی را وارد کنید").max(50),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.string().trim().email("ایمیل معتبر نیست")]).optional(),
  nationalCode: z.string().trim().max(12).optional(),
  gender: z.enum(["FEMALE", "MALE", "OTHER"]).optional(),
  birthDate: jalaliDate,
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(3000).optional(),
  allergies: z.string().trim().max(1000).optional(),
});

export const treatmentSchema = z.object({
  customerId: z.string().min(1),
  serviceId: z.string().trim().optional(),
  packageId: z.string().trim().optional(),
  staffId: z.string().trim().optional(),
  // ارقام فارسی را هم می‌پذیریم؛ \d در جاوااسکریپت فقط لاتین را می‌گیرد
  performedAt: z
    .string()
    .trim()
    .transform(toEn)
    .refine((v) => /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v), "تاریخ را به شکل ۱۴۰۵/۰۶/۱۵ وارد کنید"),
  sessionNo: z
    .union([z.literal(""), z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return null;
      const n = Number(toEn(String(v)));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }),
  description: z.string().trim().max(2000).optional(),
  beforePhoto: z.string().trim().max(500).optional(),
  afterPhoto: z.string().trim().max(500).optional(),
});

export const walkInSchema = z.object({
  customerId: z.string().min(1, "مشتری را انتخاب کنید"),
  serviceId: z.string().min(1, "خدمت را انتخاب کنید"),
  staffId: z.string().trim().optional(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را انتخاب کنید"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "ساعت را وارد کنید"),
  status: z.enum(["PENDING", "CONFIRMED", "DONE"]).optional(),
  adminNote: z.string().trim().max(1000).optional(),
});

export const timeOffSchema = z.object({
  staffId: z.string().trim().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ شروع را انتخاب کنید"),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ پایان را انتخاب کنید"),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  toTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().trim().max(200).optional(),
});

export const consentTemplateSchema = z.object({
  title: z.string().trim().min(3, "عنوان رضایت‌نامه را بنویسید").max(150),
  slug: z.string().trim().max(80).optional(),
  body: z.string().trim().min(30, "متن رضایت‌نامه خیلی کوتاه است").max(20000),
  order: z
    .union([z.literal(""), z.string(), z.number()])
    .optional()
    .transform((v) => {
      const n = Number(toEn(String(v ?? "")));
      return Number.isFinite(n) ? Math.round(n) : 0;
    }),
  isActive: z.boolean().optional(),
});

export const consentSignatureSchema = z.object({
  customerId: z.string().min(1),
  templateId: z.string().min(1, "رضایت‌نامه را انتخاب کنید"),
  fullName: z.string().trim().min(3, "نام و نام خانوادگی را کامل بنویسید").max(120),
  nationalCode: z
    .string()
    .trim()
    .transform(toEn)
    .refine((v) => v === "" || /^\d{10}$/.test(v), "کد ملی باید ۱۰ رقم باشد")
    .optional(),
  // تصویر امضا به شکل data URL؛ حدود ۲۰۰ کیلوبایت کافی است
  signatureData: z
    .string()
    .trim()
    .max(400_000, "امضا خیلی سنگین است")
    .refine((v) => v === "" || v.startsWith("data:image/png;base64,"), "امضا معتبر نیست")
    .optional(),
  agreed: z.literal(true, { message: "بدون تأیید متن، رضایت‌نامه ثبت نمی‌شود" }),
});
