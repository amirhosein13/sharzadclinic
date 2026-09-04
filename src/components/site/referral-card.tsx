"use client";

import { useState } from "react";
import { Check, Copy, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { formatToman, toFa } from "@/lib/utils";
import type { ReferralSummary } from "@/lib/referrals";

/**
 * «دوستت را بیاور». کد را با یک کلیک کپی می‌کند و روی موبایل، دکمه‌ی
 * اشتراک‌گذاری سیستم را باز می‌کند — تا فرستادنش به واتساپ یک حرکت باشد.
 */
export function ReferralCard({
  summary,
  referredReward,
}: {
  summary: ReferralSummary;
  referredReward: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(message);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی نشد. کد را دستی بردارید.");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: summary.shareText });
        return;
      } catch {
        // کاربر منصرف شد یا مرورگر پشتیبانی نکرد — می‌افتیم روی کپی
      }
    }
    await copy(summary.shareText, "متن دعوت کپی شد. برای دوستتان بفرستید.");
  }

  return (
    <section className="rounded-[2rem] border border-rose-200 bg-gradient-to-bl from-rose-50 to-cream-50 p-6 dark:border-rose-300/20 dark:from-rose-500/10 dark:to-plum-800/40">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold">دوستتان را معرفی کنید</h2>
          <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
            {referredReward > 0
              ? `دوستتان با کد شما ${formatToman(referredReward)} هدیه می‌گیرد و بعد از اولین جلسه‌اش، هدیه‌ی شما هم پیامک می‌شود.`
              : "بعد از اینکه دوستتان اولین جلسه‌اش را انجام داد، هدیه‌ی شما پیامک می‌شود."}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-dashed border-rose-300 bg-[color:var(--bg-elevated)] p-4 dark:border-rose-300/30">
        <code className="flex-1 text-center text-lg font-bold tracking-[0.3em]" dir="ltr">
          {summary.code}
        </code>
        <button
          type="button"
          onClick={() => copy(summary.code, "کد معرف کپی شد.")}
          aria-label="کپی کد"
          className="grid size-9 shrink-0 place-items-center rounded-xl transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </button>
      </div>

      <button
        type="button"
        onClick={share}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-600"
      >
        <Share2 className="size-4" />
        فرستادن دعوت برای دوستان
      </button>

      {summary.total > 0 && (
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-rose-200 pt-4 text-center dark:border-rose-300/20">
          <div>
            <dt className="text-[11px] text-[color:var(--fg-muted)]">معرفی‌شده</dt>
            <dd className="mt-1 font-bold">{toFa(summary.total)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[color:var(--fg-muted)]">در انتظار</dt>
            <dd className="mt-1 font-bold">{toFa(summary.pending)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[color:var(--fg-muted)]">هدیه گرفته‌اید</dt>
            <dd className="mt-1 font-bold">{formatToman(summary.earned, false)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
