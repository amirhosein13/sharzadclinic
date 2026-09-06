"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAYS_SHORT_FA, jalaliMonthGrid } from "@/lib/date";
import { cn, toFa } from "@/lib/utils";

export function JalaliCalendar({
  value,
  onChange,
  maxDaysAhead = 45,
  closedNote,
}: {
  value: string | null;
  onChange: (dateKey: string) => void;
  maxDaysAhead?: number;
  /** از روی ساعات کاری واقعی می‌آید، نه متن ثابت */
  closedNote?: string | null;
}) {
  const [offset, setOffset] = useState(0);
  const { cells, monthLabel } = useMemo(() => jalaliMonthGrid(offset), [offset]);

  const limit = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + maxDaysAhead);
    return d;
  }, [maxDaysAhead]);

  return (
    <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          disabled={offset <= 0}
          aria-label="ماه قبل"
          className="grid size-10 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-35"
        >
          <ChevronRight className="size-5" />
        </button>

        <p className="text-sm font-bold sm:text-base">{monthLabel}</p>

        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= 2}
          aria-label="ماه بعد"
          className="grid size-10 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-35"
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_SHORT_FA.map((d, i) => (
          <span
            key={d}
            className={cn(
              "py-2 text-xs font-medium",
              i === 6 ? "text-rose-400" : "text-[color:var(--fg-muted)]"
            )}
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const isFriday = i % 7 === 6;
          const beyondLimit = cell.date > limit;
          const disabled = !cell.inCurrentMonth || cell.isPast || isFriday || beyondLimit;
          const selected = value === cell.key;

          return (
            <button
              key={cell.key + i}
              type="button"
              disabled={disabled}
              onClick={() => onChange(cell.key)}
              aria-label={`روز ${toFa(cell.jDay)}`}
              aria-pressed={selected}
              className={cn(
                "relative aspect-square rounded-2xl text-sm font-medium transition-all",
                disabled && "cursor-not-allowed text-[color:var(--fg-muted)] opacity-30",
                !disabled && !selected && "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10",
                selected && "bg-rose-500 text-white shadow-[0_6px_18px_-8px_rgba(183,110,121,0.9)]",
                !cell.inCurrentMonth && "invisible"
              )}
            >
              {toFa(cell.jDay)}
              {cell.isToday && !selected && (
                <span className="absolute inset-x-0 bottom-1.5 mx-auto size-1 rounded-full bg-rose-500" />
              )}
            </button>
          );
        })}
      </div>

      {closedNote && (
        <p className="mt-4 border-t border-[color:var(--line)] pt-4 text-center text-xs text-[color:var(--fg-muted)]">
          {closedNote}
        </p>
      )}
    </div>
  );
}
