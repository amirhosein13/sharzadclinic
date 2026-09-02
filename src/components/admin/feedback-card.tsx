"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Eye, Loader2, Megaphone, Phone, Star } from "lucide-react";
import { publishFeedback, saveFeedbackNote, setFeedbackStatus } from "@/app/actions/feedback";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import { cn, toFa } from "@/lib/utils";

export type FeedbackView = {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  rating: number | null;
  goodLabels: string[];
  badLabels: string[];
  comment: string | null;
  wouldRecommend: boolean | null;
  canPublish: boolean;
  status: string;
  statusLabel: string;
  statusTone: "amber" | "plum" | "green" | "neutral";
  managerNote: string | null;
  serviceTitle: string | null;
  staffName: string | null;
  submittedLabel: string | null;
  isUnhappy: boolean;
};

const BTN =
  "inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-50";

export function FeedbackCard({ item }: { item: FeedbackView }) {
  const [pending, startTransition] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => () =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      setNoteOpen(false);
    });

  return (
    <article
      className={cn(
        "rounded-3xl border bg-[color:var(--bg-elevated)] p-6 shadow-soft",
        item.isUnhappy && item.status !== "RESOLVED"
          ? "border-red-300 dark:border-red-400/30"
          : "border-[color:var(--line)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/customers/${item.customerId}`}
              className="font-bold transition-colors hover:text-rose-500"
            >
              {item.customerName}
            </Link>
            <Badge tone={item.statusTone}>{item.statusLabel}</Badge>
            {item.isUnhappy && <Badge tone="red">نیاز به پیگیری</Badge>}
          </div>

          <p className="mt-1.5 text-xs text-[color:var(--fg-muted)]">
            {[item.serviceTitle, item.staffName, item.submittedLabel].filter(Boolean).join(" • ")}
          </p>
        </div>

        <div className="flex shrink-0 gap-0.5" aria-label={`امتیاز ${toFa(item.rating ?? 0)} از ۵`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={
                i < (item.rating ?? 0)
                  ? "size-4 fill-gold-400 text-gold-400"
                  : "size-4 text-[color:var(--line)]"
              }
            />
          ))}
        </div>
      </div>

      {(item.goodLabels.length > 0 || item.badLabels.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.badLabels.map((label) => (
            <span
              key={`b-${label}`}
              className="rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300"
            >
              ✕ {label}
            </span>
          ))}
          {item.goodLabels.map((label) => (
            <span
              key={`g-${label}`}
              className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              ✓ {label}
            </span>
          ))}
        </div>
      )}

      {item.comment && (
        <p className="mt-4 rounded-2xl bg-[color:var(--bg-sunken)] p-4 text-sm leading-8">
          «{item.comment}»
        </p>
      )}

      {item.wouldRecommend === false && (
        <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-300">
          کلینیک را به دیگران پیشنهاد نمی‌کند.
        </p>
      )}

      {item.managerNote && !noteOpen && (
        <p className="mt-3 rounded-2xl border border-dashed border-[color:var(--line)] p-3.5 text-xs leading-7 text-[color:var(--fg-muted)]">
          یادداشت مدیر: {item.managerNote}
        </p>
      )}

      {noteOpen && (
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await saveFeedbackNote(formData);
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
              setNoteOpen(false);
            })
          }
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="id" value={item.id} />
          <Textarea
            name="managerNote"
            rows={3}
            defaultValue={item.managerNote ?? ""}
            placeholder="چه کاری انجام شد؟ با مشتری تماس گرفته شد؟ چه چیزی در کلینیک اصلاح شد؟"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={BTN}>
              ذخیره‌ی یادداشت
            </button>
            <button type="button" onClick={() => setNoteOpen(false)} className={BTN}>
              انصراف
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color:var(--line)] pt-4">
        {pending && <Loader2 className="size-4 animate-spin text-rose-500" />}

        <a href={`tel:${item.phone}`} className={BTN} dir="ltr">
          <Phone className="size-3.5" />
          {toFa(item.phone)}
        </a>

        {!noteOpen && (
          <button type="button" onClick={() => setNoteOpen(true)} className={BTN} disabled={pending}>
            {item.managerNote ? "ویرایش یادداشت" : "افزودن یادداشت"}
          </button>
        )}

        {item.status === "SUBMITTED" && (
          <button type="button" onClick={run(() => setFeedbackStatus(item.id, "SEEN"))} className={BTN} disabled={pending}>
            <Eye className="size-3.5" />
            دیدم
          </button>
        )}

        {item.status !== "RESOLVED" && (
          <button
            type="button"
            onClick={run(() => setFeedbackStatus(item.id, "RESOLVED"))}
            className={`${BTN} text-emerald-700 dark:text-emerald-300`}
            disabled={pending}
          >
            <Check className="size-3.5" />
            رسیدگی شد
          </button>
        )}

        {item.canPublish && item.comment && (
          <button type="button" onClick={run(() => publishFeedback(item.id))} className={BTN} disabled={pending}>
            <Megaphone className="size-3.5" />
            انتشار در سایت
          </button>
        )}
      </div>
    </article>
  );
}
