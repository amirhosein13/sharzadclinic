"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { saveWorkingHours } from "@/app/actions/admin";
import { Card } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { WEEKDAYS_FA } from "@/lib/date";

type Hour = { weekday: number; isOpen: boolean; startTime: string; endTime: string };

export function WorkingHoursForm({ hours }: { hours: Hour[] }) {
  const [rows, setRows] = useState<Hour[]>(() =>
    Array.from({ length: 7 }).map((_, weekday) => {
      const found = hours.find((h) => h.weekday === weekday);
      return found ?? { weekday, isOpen: weekday !== 6, startTime: "09:00", endTime: "21:00" };
    })
  );
  const [pending, startTransition] = useTransition();

  function patch(weekday: number, changes: Partial<Hour>) {
    setRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, ...changes } : r)));
  }

  return (
    <Card className="lg:sticky lg:top-8 lg:self-start">
      <h2 className="mb-2 font-bold">ساعات کاری کلینیک</h2>
      <p className="mb-6 text-xs leading-6 text-[color:var(--fg-muted)]">
        این ساعات، سقف بازه‌ی رزرو آنلاین را تعیین می‌کند. برنامه‌ی هر پرسنل هم باید داخل همین بازه باشد.
      </p>

      <form
        action={(formData) =>
          startTransition(async () => {
            const result = await saveWorkingHours(formData);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
          })
        }
        className="space-y-3"
      >
        {rows.map((row) => (
          <div
            key={row.weekday}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--line)] p-3.5"
          >
            <label className="flex min-w-24 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name={`open-${row.weekday}`}
                checked={row.isOpen}
                onChange={(e) => patch(row.weekday, { isOpen: e.target.checked })}
                className="size-4 accent-rose-500"
              />
              <span className="text-sm font-medium">{WEEKDAYS_FA[row.weekday]}</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                type="time"
                name={`start-${row.weekday}`}
                value={row.startTime}
                disabled={!row.isOpen}
                onChange={(e) => patch(row.weekday, { startTime: e.target.value })}
                aria-label={`ساعت شروع ${WEEKDAYS_FA[row.weekday]}`}
                className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs focus:border-rose-400 focus:outline-none disabled:opacity-40"
              />
              <span className="text-xs text-[color:var(--fg-muted)]">تا</span>
              <input
                type="time"
                name={`end-${row.weekday}`}
                value={row.endTime}
                disabled={!row.isOpen}
                onChange={(e) => patch(row.weekday, { endTime: e.target.value })}
                aria-label={`ساعت پایان ${WEEKDAYS_FA[row.weekday]}`}
                className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs focus:border-rose-400 focus:outline-none disabled:opacity-40"
              />
            </div>

            {!row.isOpen && <span className="text-xs text-[color:var(--fg-muted)]">تعطیل</span>}
          </div>
        ))}

        <Button type="submit" disabled={pending} className="w-full">
          <Save className="size-4" />
          {pending ? "در حال ذخیره..." : "ذخیره‌ی ساعات کاری"}
        </Button>
      </form>
    </Card>
  );
}
