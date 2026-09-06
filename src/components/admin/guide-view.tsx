"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ChevronDown, Lightbulb, Printer, Search, TriangleAlert, X,
} from "lucide-react";
import { cn, toFa } from "@/lib/utils";
import type { GuideSection } from "@/lib/guide";

/**
 * راهنما با جستجو و بازوبسته‌شدن.
 *
 * پیش‌فرض همه بسته است تا صفحه ترسناک نباشد؛ با جستجو خودشان باز می‌شوند
 * و فقط همان چیزی که دنبالش می‌گردید می‌ماند.
 */
export function GuideView({ sections }: { sections: GuideSection[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const needle = query.trim();

  const filtered = useMemo(() => {
    if (needle.length < 2) return sections;
    const matches = (text: string) => text.includes(needle);

    return sections
      .map((section) => ({
        ...section,
        cards: section.cards.filter(
          (card) =>
            matches(card.title) ||
            matches(card.summary) ||
            (card.steps ?? []).some(
              (s) => matches(s.title) || s.lines.some(matches),
            ) ||
            (card.tips ?? []).some(matches) ||
            (card.warnings ?? []).some(matches),
        ),
      }))
      .filter((section) => section.cards.length > 0);
  }, [sections, needle]);

  const searching = needle.length >= 2;
  const total = filtered.reduce((sum, s) => sum + s.cards.length, 0);

  return (
    <div className="print:text-black">
      {/* نوار جستجو */}
      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--fg-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دنبال چه چیزی می‌گردید؟ مثلاً «صندوق» یا «رمز»"
            className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] py-3 pr-11 pl-11 text-sm outline-none focus:border-rose-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="پاک‌کردن جستجو"
              className="absolute left-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full transition-colors hover:bg-[color:var(--bg-sunken)]"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[color:var(--line)] px-4 py-3 text-sm transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <Printer className="size-4" />
          چاپ راهنما
        </button>
      </div>

      {searching && (
        <p className="mb-5 text-sm text-[color:var(--fg-muted)] print:hidden">
          {total === 0
            ? "چیزی پیدا نشد. کلمه‌ی دیگری امتحان کنید."
            : `${toFa(total)} مورد پیدا شد.`}
        </p>
      )}

      <div className="space-y-8">
        {filtered.map((section) => (
          <section key={section.id}>
            <h2 className="text-lg font-extrabold">{section.title}</h2>
            {section.intro && (
              <p className="mt-1.5 text-sm text-[color:var(--fg-muted)]">{section.intro}</p>
            )}

            <div className="mt-4 space-y-3">
              {section.cards.map((card) => {
                const isOpen = searching || open === card.id;
                return (
                  <article
                    key={card.id}
                    className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] print:break-inside-avoid"
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen && !searching ? null : card.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 p-5 text-right"
                    >
                      <span className="min-w-0">
                        <span className="block font-bold">{card.title}</span>
                        <span className="mt-1 block text-xs leading-6 text-[color:var(--fg-muted)]">
                          {card.summary}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-5 shrink-0 transition-transform print:hidden",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {isOpen && (
                      <div className="space-y-5 border-t border-[color:var(--line)] p-5">
                        {card.steps?.map((step) => (
                          <div key={step.title}>
                            <h3 className="mb-2.5 text-sm font-bold">{step.title}</h3>
                            <ol className="space-y-2">
                              {step.lines.map((line, index) => (
                                <li key={line} className="flex gap-3 text-sm leading-7">
                                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[color:var(--bg-sunken)] text-[11px] font-bold">
                                    {toFa(index + 1)}
                                  </span>
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}

                        {card.warnings?.map((warning) => (
                          <p
                            key={warning}
                            className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-xs leading-6 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
                          >
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            <span>{warning}</span>
                          </p>
                        ))}

                        {card.tips?.map((tip) => (
                          <p
                            key={tip}
                            className="flex items-start gap-2.5 rounded-xl bg-[color:var(--bg-sunken)] p-3.5 text-xs leading-6"
                          >
                            <Lightbulb className="mt-0.5 size-4 shrink-0 text-rose-500" />
                            <span>{tip}</span>
                          </p>
                        ))}

                        {card.href && (
                          <Link
                            href={card.href}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline dark:text-rose-300 print:hidden"
                          >
                            رفتن به همین بخش
                            <ArrowLeft className="size-3.5" />
                          </Link>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
