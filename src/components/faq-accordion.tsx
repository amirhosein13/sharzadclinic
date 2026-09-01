"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={cn(
              "overflow-hidden rounded-3xl border transition-colors",
              isOpen
                ? "border-rose-300/60 bg-rose-50/40 dark:border-rose-300/20 dark:bg-rose-500/5"
                : "border-[color:var(--line)] bg-[color:var(--bg-elevated)]"
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right"
            >
              <span className="text-sm font-semibold sm:text-base">{item.question}</span>
              <ChevronDown
                className={cn(
                  "size-5 shrink-0 text-rose-500 transition-transform duration-300",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            <div
              className="grid transition-all duration-300 ease-[var(--ease-out-expo)]"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-6 text-sm leading-8 text-[color:var(--fg-muted)]">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
