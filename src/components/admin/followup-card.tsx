"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check, Clock, Loader2, PhoneCall, Sparkles, UserRound, X,
} from "lucide-react";
import { resolveFollowUp, snoozeFollowUp } from "@/app/actions/followup";
import { Badge } from "@/components/ui/badge";
import { cn, toFa } from "@/lib/utils";

const KIND_META: Record<
  string,
  { label: string; tone: "red" | "amber" | "rose" | "plum"; icon: React.ComponentType<{ className?: string }> }
> = {
  NO_SHOW: { label: "مراجعه نکرد", tone: "red", icon: X },
  NEXT_SESSION: { label: "وقت جلسه‌ی بعد", tone: "rose", icon: Sparkles },
  POST_CARE: { label: "پیگیری بعد از درمان", tone: "amber", icon: Clock },
  CUSTOM: { label: "یادآوری دستی", tone: "plum", icon: UserRound },
};

/** نتیجه‌های آماده تا منشی تایپ نکند */
const OUTCOMES = [
  "نوبت گرفت",
  "پاسخ نداد",
  "بعداً تماس بگیرید",
  "فعلاً نمی‌خواهد",
  "شماره اشتباه است",
];

export type FollowUpView = {
  id: string;
  kind: string;
  dueAt: string;
  reason: string | null;
  note: string | null;
  overdueDays: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  appointmentLabel: string | null;
};

export function FollowUpCard({ item }: { item: FollowUpView }) {
  const [pending, startTransition] = useTransition();
  const [choosing, setChoosing] = useState(false);
  const meta = KIND_META[item.kind] ?? KIND_META.CUSTOM;
  const Icon = meta.icon;

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      setChoosing(false);
    });
  }

  return (
    <article
      className={cn(
        "rounded-3xl border bg-[color:var(--bg-elevated)] p-5 shadow-soft transition-opacity",
        item.overdueDays > 3
          ? "border-red-300/60 dark:border-red-400/25"
          : "border-[color:var(--line)]",
        pending && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/customers/${item.customerId}`}
              className="font-bold hover:text-rose-500"
            >
              {item.customerName}
            </Link>
            <Badge tone={meta.tone}>
              <Icon className="size-3" />
              {meta.label}
            </Badge>
            {item.overdueDays > 0 && (
              <span className="text-xs text-red-600 dark:text-red-300">
                {toFa(item.overdueDays)} روز گذشته
              </span>
            )}
          </div>

          {item.reason && (
            <p className="mt-1.5 text-sm text-[color:var(--fg-muted)]">{item.reason}</p>
          )}
          {item.appointmentLabel && (
            <p className="mt-1 text-xs text-[color:var(--fg-muted)]">{item.appointmentLabel}</p>
          )}
          {item.note && (
            <p className="mt-2 rounded-xl bg-[color:var(--bg-sunken)] p-2.5 text-xs leading-6">
              {item.note}
            </p>
          )}
        </div>

        <a
          href={`tel:${item.customerPhone}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-600"
        >
          <PhoneCall className="size-4" />
          <span dir="ltr">{toFa(item.customerPhone)}</span>
        </a>
      </div>

      <div className="mt-4 border-t border-[color:var(--line)] pt-4">
        {!choosing ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setChoosing(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 px-3.5 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-400/25 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              تماس گرفتم
            </button>

            {[3, 7, 30].map((days) => (
              <button
                key={days}
                type="button"
                disabled={pending}
                onClick={() => run(() => snoozeFollowUp(item.id, days))}
                className="rounded-xl border border-[color:var(--line)] px-3.5 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-50"
              >
                {toFa(days)} روز دیگر
              </button>
            ))}

            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => resolveFollowUp(item.id, "DISMISSED"))}
              className="mr-auto rounded-xl px-3 py-2 text-xs text-[color:var(--fg-muted)] transition-colors hover:text-red-600 disabled:opacity-50"
            >
              بایگانی
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-2.5 text-xs text-[color:var(--fg-muted)]">نتیجه‌ی تماس چه بود؟</p>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      resolveFollowUp(
                        item.id,
                        outcome === "بعداً تماس بگیرید" ? "SNOOZED" : "DONE",
                        outcome
                      )
                    )
                  }
                  className="rounded-xl border border-[color:var(--line)] px-3.5 py-2 text-xs font-medium transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                >
                  {outcome}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setChoosing(false)}
                className="rounded-xl px-3 py-2 text-xs text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              >
                انصراف
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
