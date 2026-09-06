"use client";

import { useState, useTransition } from "react";
import { Camera, Lock } from "lucide-react";
import { toast } from "sonner";
import { setMyPhotoConsent } from "@/app/actions/photos";

/**
 * اجازه‌ی انتشار عکس، از سمت خود مشتری.
 *
 * وقتی در رضایت‌نامه نوشته‌ایم «هر وقت خواستید پس بگیرید»، باید واقعاً یک
 * دکمه باشد؛ وگرنه آن جمله بی‌معنی است.
 */
export function PhotoConsent({ allowed }: { allowed: boolean | null }) {
  const [state, setState] = useState(allowed);
  const [pending, startTransition] = useTransition();

  function set(next: boolean) {
    startTransition(async () => {
      const result = await setMyPhotoConsent(next);
      if (result.ok) {
        setState(next);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft">
      <h2 className="mb-2 flex items-center gap-2 font-bold">
        {state ? <Camera className="size-4 text-rose-500" /> : <Lock className="size-4 text-rose-500" />}
        عکس‌های قبل و بعد
      </h2>

      <p className="mb-5 text-xs leading-6 text-[color:var(--fg-muted)]">
        {state
          ? "شما اجازه داده‌اید عکس‌های ناحیه‌ی تحت درمانتان (بدون نام و چهره) در سایت منتشر شود. هر وقت پس بگیرید، همان لحظه از سایت برداشته می‌شوند."
          : "عکس‌های پرونده‌ی شما فقط برای مقایسه‌ی روند درمان نگهداری می‌شوند و در سایت منتشر نمی‌شوند."}
      </p>

      <button
        type="button"
        onClick={() => set(!state)}
        disabled={pending}
        className="w-full rounded-2xl border border-[color:var(--line)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-60"
      >
        {pending
          ? "در حال ثبت..."
          : state
            ? "اجازه‌ی انتشار را پس می‌گیرم"
            : "اجازه می‌دهم عکس‌هایم منتشر شود"}
      </button>
    </div>
  );
}
