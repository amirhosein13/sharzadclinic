"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Hourglass, Loader2 } from "lucide-react";
import { joinWaitlist } from "@/app/actions/waitlist";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatJalali } from "@/lib/date";

/** yyyy-mm-dd به‌علاوه‌ی n روز */
function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * وقتی روز انتخابی وقت خالی ندارد، به‌جای بن‌بست، مشتری را در لیست
 * انتظار ثبت می‌کنیم تا منشی به‌محض خالی‌شدن وقت خبرش کند.
 */
export function WaitlistPrompt({
  serviceId,
  serviceTitle,
  dateKey,
  customer,
}: {
  serviceId: string;
  serviceTitle: string;
  dateKey: string;
  customer?: { firstName: string; lastName: string; phone: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const toKey = addDays(dateKey, 14);

  if (done) {
    return (
      <div className="mt-4 rounded-3xl border border-emerald-300/60 bg-emerald-50 p-5 text-sm leading-7 dark:border-emerald-400/25 dark:bg-emerald-500/10">
        در لیست انتظار ثبت شدید. به‌محض خالی‌شدن وقت برای «{serviceTitle}» با شما تماس می‌گیریم.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-300/70 p-4 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-white/5"
      >
        <Hourglass className="size-4" />
        مرا در لیست انتظار بگذارید
      </button>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await joinWaitlist(formData);
          if (result.ok) {
            setDone(true);
            toast.success(result.message);
          } else {
            setErrors(result.errors ?? {});
            toast.error(result.message);
          }
        })
      }
      className="mt-4 space-y-4 rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-5"
    >
      <p className="text-xs leading-6 text-[color:var(--fg-muted)]">
        شماره‌تان را بگذارید تا اگر بین {formatJalali(new Date(dateKey))} و{" "}
        {formatJalali(new Date(toKey))} وقتی خالی شد، خبرتان کنیم.
      </p>

      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="fromDate" value={dateKey} />
      <input type="hidden" name="toDate" value={toKey} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام" required error={errors.firstName}>
          <Input name="firstName" defaultValue={customer?.firstName ?? ""} />
        </Field>
        <Field label="نام خانوادگی" required error={errors.lastName}>
          <Input name="lastName" defaultValue={customer?.lastName ?? ""} />
        </Field>
      </div>

      <Field label="شماره موبایل" required error={errors.phone}>
        <Input
          name="phone"
          defaultValue={customer?.phone ?? ""}
          inputMode="tel"
          dir="ltr"
          className="text-right"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
        />
      </Field>

      <Field label="توضیح" error={errors.note} hint="مثلاً «فقط بعدازظهرها می‌توانم»">
        <Textarea name="note" rows={2} />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Hourglass className="size-4" />}
          {pending ? "در حال ثبت..." : "ثبت در لیست انتظار"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          انصراف
        </Button>
      </div>
    </form>
  );
}
