"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSignature, Phone, UserX, X } from "lucide-react";
import { StatusSelect } from "@/components/admin/status-select";
import { STATUS_META } from "@/lib/appointment-status";
import { Badge } from "@/components/ui/badge";
import { cn, formatToman, toFa } from "@/lib/utils";
import type { AppointmentStatus } from "@prisma/client";
import type { DayBlock, DayColumn } from "@/lib/day-schedule";

/** ارتفاع هر دقیقه به پیکسل — ۱ ساعت می‌شود ۹۶ پیکسل */
const PX_PER_MINUTE = 96 / 60;

const TONE: Record<AppointmentStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10",
  CONFIRMED: "border-plum-300 bg-plum-50 dark:border-plum-300/30 dark:bg-plum-400/10",
  DONE: "border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10",
  CANCELLED: "border-[color:var(--line)] bg-[color:var(--bg-sunken)] opacity-60",
  NO_SHOW: "border-red-300 bg-red-50 dark:border-red-400/30 dark:bg-red-500/10",
};

function hhmm(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function DayBoard({
  columns,
  fromMinute,
  toMinute,
  stepMinutes,
  nowMinute,
}: {
  columns: DayColumn[];
  fromMinute: number;
  toMinute: number;
  stepMinutes: number;
  /** اگر امروز است، خط «الان» کجاست */
  nowMinute: number | null;
}) {
  const [selected, setSelected] = useState<DayBlock | null>(null);

  const height = (toMinute - fromMinute) * PX_PER_MINUTE;
  const ticks: number[] = [];
  for (let m = fromMinute; m <= toMinute; m += 60) ticks.push(m);

  // خطوط کم‌رنگ روی گام زمانی کلینیک (مثلاً هر نیم‌ساعت)
  const subTicks: number[] = [];
  if (stepMinutes > 0 && stepMinutes < 60) {
    for (let m = fromMinute; m <= toMinute; m += stepMinutes) {
      if (m % 60 !== 0) subTicks.push(m);
    }
  }

  const top = (minute: number) => (Math.max(minute, fromMinute) - fromMinute) * PX_PER_MINUTE;
  const blockHeight = (block: { startMinute: number; endMinute: number }) =>
    Math.max(28, (Math.min(block.endMinute, toMinute) - Math.max(block.startMinute, fromMinute)) * PX_PER_MINUTE);

  return (
    <>
      <div className="overflow-x-auto rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-soft">
        <div className="min-w-max">
          {/* سر ستون‌ها */}
          <div className="flex border-b border-[color:var(--line)]">
            <div className="w-16 shrink-0" />
            {columns.map((column) => (
              <div
                key={column.staffId}
                className="w-56 shrink-0 border-r border-[color:var(--line)] p-3 text-center first:border-r-0"
              >
                <p className="truncate text-sm font-bold">{column.staffName}</p>
                <p className="mt-0.5 text-[11px] text-[color:var(--fg-muted)]" dir="ltr">
                  {column.shiftStart !== null && column.shiftEnd !== null
                    ? `${hhmm(column.shiftStart)} – ${hhmm(column.shiftEnd)}`
                    : "—"}
                </p>
              </div>
            ))}
          </div>

          {/* شبکه */}
          <div className="flex">
            {/* ساعت‌ها */}
            <div className="relative w-16 shrink-0" style={{ height }}>
              {ticks.map((m) => (
                <span
                  key={m}
                  className="absolute left-2 -translate-y-1/2 text-[11px] tabular-nums text-[color:var(--fg-muted)]"
                  style={{ top: top(m) }}
                  dir="ltr"
                >
                  {toFa(hhmm(m))}
                </span>
              ))}
            </div>

            {columns.map((column) => (
              <div
                key={column.staffId}
                className="relative w-56 shrink-0 border-r border-[color:var(--line)] last:border-r-0"
                style={{ height }}
              >
                {/* خطوط ساعت و گام */}
                {subTicks.map((m) => (
                  <div
                    key={`sub-${m}`}
                    className="absolute inset-x-0 border-t border-dashed border-[color:var(--line)] opacity-40"
                    style={{ top: top(m) }}
                  />
                ))}
                {ticks.map((m) => (
                  <div
                    key={m}
                    className="absolute inset-x-0 border-t border-[color:var(--line)]"
                    style={{ top: top(m) }}
                  />
                ))}

                {/* بیرون از شیفت، سایه‌دار */}
                {column.shiftStart !== null && column.shiftStart > fromMinute && (
                  <div
                    className="absolute inset-x-0 bg-[color:var(--bg-sunken)]/70"
                    style={{ top: 0, height: top(column.shiftStart) }}
                  />
                )}
                {column.shiftEnd !== null && column.shiftEnd < toMinute && (
                  <div
                    className="absolute inset-x-0 bg-[color:var(--bg-sunken)]/70"
                    style={{ top: top(column.shiftEnd), bottom: 0 }}
                  />
                )}

                {/* مرخصی */}
                {column.offs.map((off) => (
                  <div
                    key={off.id}
                    title={off.reason ?? "مرخصی"}
                    className="absolute inset-x-1 rounded-xl border border-dashed border-red-300 bg-red-50/70 p-1.5 text-[11px] text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300"
                    style={{ top: top(off.startMinute), height: blockHeight(off) }}
                  >
                    مرخصی{off.reason ? ` — ${off.reason}` : ""}
                  </div>
                ))}

                {/* نوبت‌ها */}
                {column.blocks.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => setSelected(block)}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-xl border p-2 text-right transition-transform hover:z-10 hover:scale-[1.02]",
                      TONE[block.status],
                    )}
                    style={{ top: top(block.startMinute), height: blockHeight(block) }}
                  >
                    <span className="block truncate text-xs font-bold">{block.customerName}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[color:var(--fg-muted)]">
                      {toFa(block.timeLabel)} • {block.serviceTitle}
                    </span>
                    {block.hasPaid && (
                      <span className="mt-0.5 block text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        {formatToman(block.paidTotal, false)}
                      </span>
                    )}
                    {block.noShowStreak > 0 && (
                      <span
                        title={`${toFa(block.noShowStreak)} بار پشت‌سرهم نیامده است`}
                        className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-300"
                      >
                        <UserX className="size-3 shrink-0" />
                        سابقه‌ی نیامدن
                      </span>
                    )}
                    {block.needsConsent.length > 0 && (
                      <span
                        title={`رضایت‌نامه‌ی امضانشده: ${block.needsConsent.join("، ")}`}
                        className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                      >
                        <FileSignature className="size-3 shrink-0" />
                        رضایت‌نامه ندارد
                      </span>
                    )}
                  </button>
                ))}

                {/* خط «الان» */}
                {nowMinute !== null && nowMinute >= fromMinute && nowMinute <= toMinute && (
                  <div
                    className="pointer-events-none absolute inset-x-0 border-t-2 border-rose-500"
                    style={{ top: top(nowMinute) }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* جزئیات نوبت */}
      {selected && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
          <div className="fixed inset-0 bg-plum-900/55 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`نوبت ${selected.code}`}
            className="relative w-full max-w-md rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-4 sm:p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href={`/admin/customers/${selected.customerId}`}
                  className="text-lg font-bold transition-colors hover:text-rose-500"
                >
                  {selected.customerName}
                </Link>
                <p className="mt-1 text-sm text-[color:var(--fg-muted)]">
                  {selected.serviceTitle} • {toFa(selected.timeLabel)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="بستن"
                className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-[color:var(--bg-sunken)]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_META[selected.status].tone}>
                {STATUS_META[selected.status].label}
              </Badge>
              <span className="text-xs text-[color:var(--fg-muted)]" dir="ltr">
                {selected.code}
              </span>
              {selected.hasPaid && (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {formatToman(selected.paidTotal)} دریافت شده
                </span>
              )}
            </div>

            {selected.noShowStreak > 0 && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm leading-7 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
                <b>{toFa(selected.noShowStreak)} بار پشت‌سرهم نیامده است.</b> بهتر است امروز یک
                زنگ یادآوری بزنید تا این وقت هم هدر نرود.
              </div>
            )}

            {selected.needsConsent.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm leading-7 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                <b>پیش از شروع، رضایت‌نامه بگیرید:</b> {selected.needsConsent.join("، ")}
                <br />
                <Link
                  href={`/admin/customers/${selected.customerId}`}
                  className="underline underline-offset-4"
                >
                  رفتن به پرونده‌ی مراجعه‌کننده
                </Link>
              </div>
            )}

            {(selected.note || selected.adminNote) && (
              <div className="mt-4 space-y-2">
                {selected.note && (
                  <p className="rounded-xl bg-[color:var(--bg-sunken)] p-3 text-sm leading-7">
                    یادداشت مشتری: {selected.note}
                  </p>
                )}
                {selected.adminNote && (
                  <p className="rounded-xl bg-[color:var(--bg-sunken)] p-3 text-sm leading-7">
                    یادداشت داخلی: {selected.adminNote}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 space-y-3 border-t border-[color:var(--line)] pt-5">
              <StatusSelect id={selected.id} value={selected.status} />
              <a
                href={`tel:${selected.phone}`}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] p-3 text-sm font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
                dir="ltr"
              >
                <Phone className="size-4" />
                {toFa(selected.phone)}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
