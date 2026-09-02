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
