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
