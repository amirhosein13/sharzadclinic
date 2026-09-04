"use client";

import { useState, useTransition } from "react";
import { Megaphone, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { createCampaign, previewAudience } from "@/app/actions/campaigns";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/admin/page-header";
import { toFa } from "@/lib/utils";

const INACTIVE_OPTIONS = [
  { value: "", label: "فرقی نمی‌کند" },
  { value: "3", label: "۳ ماه است نیامده‌اند" },
  { value: "6", label: "۶ ماه است نیامده‌اند" },
  { value: "12", label: "یک سال است نیامده‌اند" },
];

/**
 * ساخت پیامک گروهی. عمداً دو مرحله‌ای است: اول پیش‌نویس، بعد شروع ارسال —
 * تا کسی با یک کلیک اشتباهی به صدها نفر پیامک نفرستد.
 */
export function CampaignForm({ services }: { services: { id: string; title: string }[] }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  // هر ۷۰ حرف فارسی یک پیامک حساب می‌شود
  const parts = message.trim().length === 0 ? 0 : Math.ceil(message.trim().length / 70);

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <Megaphone className="size-4" />
        ارسال گروهی تازه
      </h2>
      <p className="mb-6 text-xs leading-6 text-[color:var(--fg-muted)]">
        کسانی که «پیامک تبلیغاتی نمی‌خواهم» را زده‌اند، هرگز در فهرست نمی‌آیند. یک خط راهنمای
        انصراف هم خودکار به انتهای متن اضافه می‌شود.
      </p>

      <form
        action={(formData) =>
          startTransition(async () => {
            const result = await createCampaign(formData);
            if (result.ok) {
              toast.success(result.message);
              setMessage("");
              setPreview(null);
            } else {
              toast.error(result.message);
            }
          })
        }
        className="space-y-5"
      >
        <Field label="نام این ارسال" required hint="فقط برای خودتان — در پیامک نمی‌آید">
          <Input name="title" placeholder="مثلاً دعوت مشتریان لیزر" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="کسانی که این خدمت را گرفته‌اند" hint="خالی یعنی همه">
            <Select name="serviceId" defaultValue="">
              <option value="">همه‌ی خدمات</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="مدت نیامدن">
            <Select name="inactiveMonths" defaultValue="">
              {INACTIVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--line)] p-4 text-sm">
          <input type="checkbox" name="onlyWithVisits" className="size-4 accent-rose-500" />
          فقط کسانی که حداقل یک جلسه‌ی انجام‌شده دارند
        </label>

        <Field
          label="متن پیامک"
          required
          hint={parts > 0 ? `${toFa(message.trim().length)} حرف — حدود ${toFa(parts)} پیامک برای هر نفر` : "هر ۷۰ حرف یک پیامک حساب می‌شود"}
        >
          <Textarea
            name="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="سلام! این ماه روی لیزر ۲۰٪ تخفیف داریم..."
          />
        </Field>

        {parts >= 3 && (
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3.5 text-xs leading-6 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            این متن برای هر نفر {toFa(parts)} پیامک حساب می‌شود. کوتاه‌ترش کنید تا هزینه‌ی
            ارسال چند برابر نشود.
          </p>
        )}

        {preview && (
          <p className="rounded-2xl bg-[color:var(--bg-sunken)] p-3.5 text-sm">{preview}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={(e) => {
              const form = (e.currentTarget as HTMLButtonElement).form;
              if (!form) return;
              startTransition(async () => {
                const result = await previewAudience(new FormData(form));
                setPreview(result.message);
              });
            }}
          >
            <Search className="size-4" />
            چند نفر می‌گیرند؟
          </Button>

          <Button type="submit" disabled={pending}>
            {pending ? "در حال ثبت..." : "ساخت پیش‌نویس"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
