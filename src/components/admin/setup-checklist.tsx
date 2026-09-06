"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Rocket, TriangleAlert } from "lucide-react";
import { cn, toFa } from "@/lib/utils";
import type { SetupStep } from "@/lib/setup-status";

/**
 * «چه کارهایی مانده تا کلینیک راه بیفتد؟»
 * وقتی همه‌ی گام‌ها انجام شد، کارت خودش جمع می‌شود تا داشبورد شلوغ نماند.
 */
export function SetupChecklist({
  steps,
  done,
  total,
  allDone,
}: {
  steps: SetupStep[];
  done: number;
  total: number;
  allDone: boolean;
}) {
  const [open, setOpen] = useState(!allDone);
  const remaining = steps.filter((s) => !s.done);
  const criticalLeft = remaining.filter((s) => s.critical).length;
  const percent = Math.round((done / total) * 100);

  return (
    <section
      className={cn(
        "mb-6 overflow-hidden rounded-3xl border shadow-soft",
        allDone
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10"
          : criticalLeft > 0
            ? "border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10"
            : "border-[color:var(--line)] bg-[color:var(--bg-elevated)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-4 sm:p-6 text-right"
      >
        <span className="flex min-w-0 items-center gap-4">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl",
              allDone
                ? "bg-emerald-500 text-white"
                : "bg-gradient-to-br from-rose-400 to-rose-600 text-white",
            )}
          >
            {allDone ? <Check className="size-5" /> : <Rocket className="size-5" />}
          </span>
          <span className="min-w-0">
            <span className="block font-bold">
              {allDone
                ? "کلینیک آماده است 🎉"
                : `${toFa(remaining.length)} کار مانده تا کلینیک آماده شود`}
            </span>
            <span className="mt-1 block text-xs leading-6 text-[color:var(--fg-muted)]">
              {allDone
                ? "همه‌ی کارهای راه‌اندازی انجام شده است."
                : criticalLeft > 0
                  ? `${toFa(criticalLeft)} تای آن‌ها ضروری است — تا انجام نشوند بخشی از سایت کار نمی‌کند.`
                  : "کارهای باقی‌مانده اختیاری‌اند."}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm font-bold tabular-nums sm:block">
            {toFa(done)}/{toFa(total)}
          </span>
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {!allDone && (
        <div className="px-6 pb-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
            <div
              className="h-full rounded-full bg-gradient-to-l from-rose-400 to-rose-600 transition-all"
              style={{ width: `${Math.max(percent, 3)}%` }}
            />
          </div>
        </div>
      )}

      {open && (
        <ul className="space-y-2 p-4 pt-4">
          {steps.map((step) => (
            <li key={step.key}>
              <Link
                href={step.href}
                className={cn(
                  "flex items-start gap-3 rounded-2xl p-3.5 transition-colors",
                  step.done
                    ? "opacity-60"
                    : "bg-[color:var(--bg-elevated)] hover:bg-[color:var(--bg-sunken)]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border",
                    step.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : step.critical
                        ? "border-amber-500 text-amber-600 dark:text-amber-300"
                        : "border-[color:var(--line)] text-[color:var(--fg-muted)]",
                  )}
                >
                  {step.done ? (
                    <Check className="size-3.5" />
                  ) : step.critical ? (
                    <TriangleAlert className="size-3" />
                  ) : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      step.done && "line-through",
                    )}
                  >
                    {step.title}
                  </span>
                  {!step.done && (
                    <span className="mt-1 block text-xs leading-6 text-[color:var(--fg-muted)]">
                      {step.why}
                    </span>
                  )}
                </span>

                {!step.done && (
                  <ArrowLeft className="mt-1 size-4 shrink-0 text-[color:var(--fg-muted)]" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
