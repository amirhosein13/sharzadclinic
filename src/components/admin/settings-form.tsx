"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { saveSettings } from "@/app/actions/admin";
import { Card } from "@/components/admin/page-header";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { SettingsMap } from "@/lib/settings";

const FIELDS: {
  key: string;
  label: string;
  type?: "text" | "textarea";
  hint?: string;
  ltr?: boolean;
}[] = [
  { key: "clinicName", label: "نام کلینیک" },
  { key: "tagline", label: "شعار", hint: "در هیرو صفحه‌ی اصلی نمایش داده می‌شود" },
  { key: "description", label: "معرفی کوتاه", type: "textarea", hint: "در فوتر و متای SEO استفاده می‌شود" },
  { key: "phone", label: "تلفن ثابت", ltr: true },
  { key: "mobile", label: "موبایل", ltr: true },
  { key: "whatsapp", label: "واتساپ", hint: "با کد کشور و بدون صفر — مثلاً 989123456789", ltr: true },
  { key: "email", label: "ایمیل", ltr: true },
  { key: "address", label: "آدرس", type: "textarea" },
  { key: "instagram", label: "اینستاگرام", ltr: true },
  { key: "telegram", label: "تلگرام", ltr: true },
  { key: "mapLat", label: "عرض جغرافیایی", ltr: true },
  { key: "mapLng", label: "طول جغرافیایی", ltr: true },
  { key: "establishedYear", label: "سال تأسیس", ltr: true },
  { key: "bookingLeadHours", label: "حداقل فاصله تا نوبت (ساعت)", hint: "مثلاً ۳ یعنی نوبت‌های ۳ ساعت آینده قابل رزرو نیستند", ltr: true },
  { key: "bookingHorizonDays", label: "افق رزرو (روز)", hint: "تا چند روز آینده بتوان نوبت گرفت", ltr: true },
  { key: "slotStepMinutes", label: "گام زمانی نوبت‌ها (دقیقه)", hint: "مثلاً ۳۰ یعنی نوبت‌ها هر نیم‌ساعت", ltr: true },
  { key: "depositPercent", label: "درصد بیعانه‌ی آنلاین", hint: "چند درصد از قیمت خدمت هنگام رزرو آنلاین پرداخت شود", ltr: true },
  { key: "followUpAfterDays", label: "فاصله‌ی پیگیری جلسه‌ی بعد (روز)", hint: "اگر مشتری این‌قدر روز نیامده باشد، در فهرست پیگیری منشی می‌آید", ltr: true },
  { key: "feedbackAutoSms", label: "پیامک نظرسنجی خودکار", hint: "۱ یعنی پس از «انجام‌شده» شدن هر نوبت، پیامک نظرسنجی برود. ۰ یعنی فقط دستی", ltr: true },
  { key: "managerPhone", label: "موبایل مدیر (گزارش شبانه)", hint: "خلاصه‌ی هر روز به این شماره پیامک می‌شود. خالی یعنی همان موبایل کلینیک", ltr: true },
  { key: "dailyDigestSms", label: "گزارش شبانه‌ی پیامکی", hint: "۱ یعنی فعال، ۰ یعنی خاموش", ltr: true },
  { key: "birthdaySms", label: "پیامک تبریک تولد", hint: "۱ یعنی فعال، ۰ یعنی خاموش. فقط برای مشتریانی که تاریخ تولدشان ثبت شده", ltr: true },
  { key: "birthdayDiscountCode", label: "کد تخفیف تولد", hint: "اگر بگذارید، در پیامک تولد معرفی می‌شود. اول از بخش کد تخفیف بسازیدش", ltr: true },
  { key: "postCareSms", label: "پیامک خودکار پس از درمان", hint: "۱ یعنی فعال. برای خدماتی که در فرم خدمت «پیگیری پس از درمان» برایشان تنظیم شده", ltr: true },
  { key: "winBackAfterMonths", label: "بازگردانی مشتری غایب (ماه)", hint: "بعد از این مدت نیامدن، مشتری در فهرست پیگیری می‌آید", ltr: true },
  { key: "winBackSms", label: "پیامک خودکار بازگردانی", hint: "۱ یعنی فعال، ۰ یعنی فقط در فهرست منشی بماند", ltr: true },
  { key: "winBackDiscountCode", label: "کد تخفیف بازگردانی", hint: "اگر بگذارید، در پیامک بازگردانی معرفی می‌شود", ltr: true },
];

export function SettingsForm({ settings }: { settings: SettingsMap }) {
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <h2 className="mb-6 font-bold">اطلاعات کلینیک</h2>
      <form
        action={(formData) =>
          startTransition(async () => {
            const result = await saveSettings(formData);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
          })
        }
        className="space-y-5"
      >
        {FIELDS.map((field) => (
          <Field key={field.key} label={field.label} hint={field.hint}>
            {field.type === "textarea" ? (
              <Textarea name={field.key} defaultValue={settings[field.key] ?? ""} rows={3} />
            ) : (
              <Input
                name={field.key}
                defaultValue={settings[field.key] ?? ""}
                dir={field.ltr ? "ltr" : undefined}
                className={field.ltr ? "text-right" : undefined}
              />
            )}
          </Field>
        ))}

        <Button type="submit" disabled={pending} className="w-full">
          <Save className="size-4" />
          {pending ? "در حال ذخیره..." : "ذخیره‌ی تنظیمات"}
        </Button>
      </form>
    </Card>
  );
}
