"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { saveStaffSchedule } from "@/app/actions/content";
import { WEEKDAYS_FA } from "@/lib/date";

export type ScheduleRow = { weekday: number; startTime: string; endTime: string };

export function ScheduleForm({
  staffId,
  staffName,
  schedules,
}: {
  staffId: string;
  staffName: string;
  schedules: ScheduleRow[];
}) {
  return (
    <CrudDialog
      title={`برنامه‌ی هفتگی ${staffName}`}
      description="فقط ساعت‌هایی که اینجا تعیین می‌کنید در رزرو آنلاین قابل انتخاب‌اند و باید داخل ساعات کاری کلینیک باشند."
      action={saveStaffSchedule}
      submitLabel="ذخیره‌ی برنامه"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <CalendarClock className="size-3.5" />
          برنامه‌ی هفتگی
        </button>
      )}
    >
      {() => <ScheduleRows staffId={staffId} schedules={schedules} />}
    </CrudDialog>
  );
}

function ScheduleRows({ staffId, schedules }: { staffId: string; schedules: ScheduleRow[] }) {
  const [rows, setRows] = useState(() =>
    Array.from({ length: 7 }).map((_, weekday) => {
      const found = schedules.find((s) => s.weekday === weekday);
      return {
        weekday,
        active: !!found,
        startTime: found?.startTime ?? "09:00",
        endTime: found?.endTime ?? "18:00",
      };
    })
  );

  function patch(weekday: number, changes: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, ...changes } : r)));
  }

  return (
    <>
      <input type="hidden" name="staffId" value={staffId} />
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.weekday}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--line)] p-3.5"
          >
            <label className="flex min-w-24 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name={`active-${row.weekday}`}
                checked={row.active}
                onChange={(e) => patch(row.weekday, { active: e.target.checked })}
                className="size-4 accent-rose-500"
              />
              <span className="text-sm font-medium">{WEEKDAYS_FA[row.weekday]}</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                type="time"
                name={`start-${row.weekday}`}
                value={row.startTime}
                disabled={!row.active}
                onChange={(e) => patch(row.weekday, { startTime: e.target.value })}
                aria-label={`ساعت شروع ${WEEKDAYS_FA[row.weekday]}`}
                className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs focus:border-rose-400 focus:outline-none disabled:opacity-40"
              />
              <span className="text-xs text-[color:var(--fg-muted)]">تا</span>
              <input
                type="time"
                name={`end-${row.weekday}`}
                value={row.endTime}
                disabled={!row.active}
                onChange={(e) => patch(row.weekday, { endTime: e.target.value })}
                aria-label={`ساعت پایان ${WEEKDAYS_FA[row.weekday]}`}
                className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs focus:border-rose-400 focus:outline-none disabled:opacity-40"
              />
            </div>

            {!row.active && <span className="text-xs text-[color:var(--fg-muted)]">تعطیل</span>}
          </div>
        ))}
      </div>
    </>
  );
}
