"use client";

import { useState, useTransition } from "react";
import { BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { toggleSmsOptOut } from "@/app/actions/campaigns";

/**
 * «پیامک تبلیغاتی برایم نفرست».
 * صریح می‌گوییم چه چیزی قطع می‌شود و چه چیزی نه — وگرنه مشتری از ترس
 * ازدست‌دادن یادآوری نوبت، هیچ‌وقت خاموشش نمی‌کند و کلافه می‌شود.
 */
export function SmsPreference({ optedOut }: { optedOut: boolean }) {
  const [off, setOff] = useState(optedOut);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !off;
    startTransition(async () => {
      const result = await toggleSmsOptOut(next);
      if (result.ok) {
        setOff(next);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft">
      <h2 className="mb-2 flex items-center gap-2 font-bold">
        {off ? <BellOff className="size-4 text-rose-500" /> : <BellRing className="size-4 text-rose-500" />}
        پیامک‌های اطلاع‌رسانی
      </h2>
      <p className="mb-5 text-xs leading-6 text-[color:var(--fg-muted)]">
        {off
          ? "پیامک تخفیف‌ها و خبرها برایتان فرستاده نمی‌شود. یادآوری نوبت و کد ورود همچنان می‌آید."
          : "گاهی خبر تخفیف‌ها و خدمات تازه را پیامک می‌کنیم. هر وقت خواستید خاموشش کنید."}
      </p>

      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="w-full rounded-2xl border border-[color:var(--line)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-60"
      >
        {pending ? "در حال ثبت..." : off ? "دوباره برایم بفرست" : "پیامک تبلیغاتی نمی‌خواهم"}
      </button>
    </div>
  );
}
