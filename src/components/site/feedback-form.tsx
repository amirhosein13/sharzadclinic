"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { submitFeedback } from "@/app/actions/feedback";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn, toFa } from "@/lib/utils";

const RATING_LABELS = ["", "خیلی ناراضی", "ناراضی", "متوسط", "راضی", "خیلی راضی"];

export function FeedbackForm({
  token,
  aspects,
  customerName,
  serviceTitle,
}: {
  token: string;
  aspects: { key: string; label: string }[];
  customerName: string;
  serviceTitle: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [good, setGood] = useState<string[]>([]);
  const [bad, setBad] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // هر جنبه یا خوب است یا بد یا هیچ‌کدام — انتخاب یکی، دیگری را برمی‌دارد
  function toggle(key: string, side: "good" | "bad") {
    if (side === "good") {
      setBad((b) => b.filter((k) => k !== key));
      setGood((g) => (g.includes(key) ? g.filter((k) => k !== key) : [...g, key]));
    } else {
      setGood((g) => g.filter((k) => k !== key));
      setBad((b) => (b.includes(key) ? b.filter((k) => k !== key) : [...b, key]));
    }
  }

  if (done) {
    return (
      <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-10 text-center shadow-soft">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Check className="size-8" />
        </span>
        <h2 className="mt-6 text-xl font-bold">ثبت شد</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-[color:var(--fg-muted)]">{done}</p>
      </div>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await submitFeedback(formData);
          if (result.ok) setDone(result.message);
          else toast.error(result.message);
        })
      }
      className="space-y-8 rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 shadow-soft sm:p-9"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="rating" value={rating} />
      {good.map((k) => (
        <input key={`g-${k}`} type="hidden" name="goodTags" value={k} />
      ))}
      {bad.map((k) => (
        <input key={`b-${k}`} type="hidden" name="badTags" value={k} />
      ))}

      <div>
        <h2 className="text-lg font-bold">
          {customerName} عزیز، از «{serviceTitle}» چقدر راضی بودید؟
        </h2>
        <div className="mt-5 flex flex-wrap items-center gap-2" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} ستاره — ${RATING_LABELS[n]}`}
              className="rounded-xl p-1 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "size-9 transition-colors",
                  n <= (hover || rating)
                    ? "fill-gold-400 text-gold-400"
                    : "text-[color:var(--line)]",
                )}
              />
            </button>
          ))}
          <span className="mr-3 text-sm font-medium text-[color:var(--fg-muted)]" dir="rtl">
            {RATING_LABELS[hover || rating]}
          </span>
        </div>
      </div>

      {rating > 0 && (
        <>
          <div>
            <h3 className="font-bold">از چه چیزهایی راضی بودید و از چه چیزهایی نه؟</h3>
            <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
              اختیاری است، ولی همین‌ها کمکمان می‌کند بدانیم دقیقاً کجا را بهتر کنیم.
            </p>

            <ul className="mt-5 space-y-2">
              {aspects.map((aspect) => {
                const isGood = good.includes(aspect.key);
                const isBad = bad.includes(aspect.key);
                return (
                  <li
                    key={aspect.key}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-2.5"
                  >
                    <span className="text-sm">{aspect.label}</span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => toggle(aspect.key, "good")}
                        aria-label={`${aspect.label} خوب بود`}
                        aria-pressed={isGood}
                        className={cn(
                          "grid size-9 place-items-center rounded-xl border transition-colors",
                          isGood
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-[color:var(--line)] text-[color:var(--fg-muted)] hover:border-emerald-300",
                        )}
                      >
                        <ThumbsUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(aspect.key, "bad")}
                        aria-label={`${aspect.label} خوب نبود`}
                        aria-pressed={isBad}
                        className={cn(
                          "grid size-9 place-items-center rounded-xl border transition-colors",
                          isBad
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-[color:var(--line)] text-[color:var(--fg-muted)] hover:border-red-300",
                        )}
                      >
                        <ThumbsDown className="size-4" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-bold">چیزی هست که بخواهید بگویید؟</h3>
            <Textarea
              name="comment"
              rows={4}
              placeholder="هر چیزی که به نظرتان می‌رسد — خوب یا بد. مستقیم به دست مدیر می‌رسد."
            />
          </div>

          <div>
            <h3 className="mb-3 font-bold">کلینیک ما را به دوستانتان پیشنهاد می‌کنید؟</h3>
            <div className="flex gap-3">
              {[
                { value: "yes", label: "بله" },
                { value: "no", label: "خیر" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] p-3.5 text-sm transition-colors has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50/60 dark:has-[:checked]:bg-rose-500/10"
                >
                  <input
                    type="radio"
                    name="wouldRecommend"
                    value={option.value}
                    className="size-4 accent-rose-500"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--line)] p-4 text-sm leading-7">
            <input type="checkbox" name="canPublish" className="mt-1.5 size-4 accent-rose-500" />
            اجازه می‌دهم نظرم با نامم در سایت کلینیک منتشر شود.
          </label>

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {pending ? "در حال ثبت..." : "ثبت نظر"}
          </Button>
        </>
      )}

      {rating === 0 && (
        <p className="rounded-2xl bg-[color:var(--bg-sunken)] p-4 text-center text-sm text-[color:var(--fg-muted)]">
          برای ادامه، امتیاز {toFa(1)} تا {toFa(5)} را انتخاب کنید.
        </p>
      )}
    </form>
  );
}
