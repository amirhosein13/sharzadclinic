"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { setTaskDone } from "@/app/actions/duties";
import { cn } from "@/lib/utils";

/**
 * تیکِ انجام‌شدنِ یک کار.
 *
 * عمداً یک دکمه‌ی بزرگِ تمام‌عرض است، نه چک‌باکس ریز: این صفحه را
 * کارمند روی گوشی و با عجله باز می‌کند. کلِ ردیف قابل زدن است.
 *
 * از useOptimistic استفاده می‌شود تا تیک فوری دیده شود. بدون آن،
 * بین زدن و برگشتِ سرور یک وقفه است و کاربر دوباره می‌زند — یعنی
 * کار باز و بسته می‌شود.
 */
export function TaskCheck({
  id,
  done,
  title,
  note,
  meta,
  late,
}: {
  id: string;
  done: boolean;
  title: string;
  note?: string | null;
  /** «آخر وقت» یا «هفتگی» — راهنمای کوچک زیر عنوان */
  meta?: string | null;
  /** «۳ روز عقب» */
  late?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);

  function toggle() {
    const next = !optimisticDone;
    startTransition(async () => {
      setOptimisticDone(next);
      const result = await setTaskDone(id, next);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // کارِ عقب‌افتاده بعد از تیک از فهرست «مانده از روزهای قبل»
      // بیرون می‌رود و کلاً ناپدید می‌شود. بدون این پیام، کارمند
      // نمی‌فهمد تیکش ثبت شد یا صفحه قاطی کرده.
      toast.success(result.message);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={optimisticDone}
      className={cn(
        "flex w-full items-start gap-3.5 rounded-2xl border p-4 text-right transition-colors disabled:opacity-60",
        optimisticDone
          ? "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-500/5"
          : "border-[color:var(--line)] hover:bg-[color:var(--bg-sunken)]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-colors",
          optimisticDone
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-[color:var(--line)]",
        )}
      >
        {optimisticDone && <Check className="size-4" strokeWidth={3} />}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-medium leading-7",
            optimisticDone && "text-[color:var(--fg-muted)] line-through",
          )}
        >
          {title}
        </span>
        {note && (
          <span className="mt-1 block text-xs leading-6 text-[color:var(--fg-muted)]">{note}</span>
        )}
        {(meta || late) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
            {late && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {late}
              </span>
            )}
            {meta && <span className="text-[color:var(--fg-subtle)]">{meta}</span>}
          </span>
        )}
      </span>
    </button>
  );
}
