"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { updateMyProfile } from "@/app/actions/customer";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/utils";

export function ProfileForm({
  firstName,
  lastName,
  email,
  phone,
}: {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await updateMyProfile(formData);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
      className="space-y-4"
    >
      <Field label="نام" required>
        <Input name="firstName" defaultValue={firstName} />
      </Field>

      <Field label="نام خانوادگی" required>
        <Input name="lastName" defaultValue={lastName} />
      </Field>

      <Field label="ایمیل" hint="برای دریافت تأیید نوبت — اختیاری">
        <Input name="email" type="email" defaultValue={email ?? ""} dir="ltr" className="text-right" />
      </Field>

      <div>
        <label className="mb-2 block text-sm font-medium">شماره موبایل</label>
        <p className="rounded-2xl bg-[color:var(--bg-sunken)] px-4 py-3 text-sm" dir="ltr">
          <span className="block text-right">{toFa(phone)}</span>
        </p>
        <p className="mt-1.5 text-xs text-[color:var(--fg-muted)]">
          برای تغییر شماره با کلینیک تماس بگیرید.
        </p>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {pending ? "در حال ذخیره..." : "ذخیره‌ی اطلاعات"}
      </Button>
    </form>
  );
}
