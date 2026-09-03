import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Coffee } from "lucide-react";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { DayBoard } from "@/components/admin/day-board";
import { buildDaySchedule } from "@/lib/day-schedule";
import { formatJalaliWithWeekday, ymdKey } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return ymdKey(date);
}

const NAV =
  "inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3.5 py-2 text-sm transition-colors hover:bg-[color:var(--bg-sunken)]";

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await guardPage("appointments.all");

  const { date: raw } = await searchParams;
  const today = ymdKey(new Date());
  const dateKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;

  const day = await buildDaySchedule(dateKey);
  const isToday = dateKey === today;
  const now = new Date();
  const nowMinute = isToday ? now.getHours() * 60 + now.getMinutes() : null;

  return (
    <>
      <AdminPageHeader
        title="برنامه‌ی روز"
        description={`${formatJalaliWithWeekday(day.date)} — ${toFa(day.totals.appointments)} نوبت، ${toFa(
          day.totals.done,
        )} انجام‌شده${day.totals.revenue > 0 ? `، ${formatToman(day.totals.revenue)} دریافتی` : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/day?date=${shift(dateKey, -1)}`} className={NAV}>
              <ChevronRight className="size-4" />
              روز قبل
            </Link>
            {!isToday && (
              <Link href="/admin/day" className={NAV}>
                امروز
              </Link>
            )}
            <Link href={`/admin/day?date=${shift(dateKey, 1)}`} className={NAV}>
              روز بعد
              <ChevronLeft className="size-4" />
            </Link>
          </div>
        }
      />

      {!day.isClinicOpen && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-4 text-sm">
          <Coffee className="size-5 shrink-0 text-[color:var(--fg-muted)]" />
          این روز در «تنظیمات ← ساعات کاری» تعطیل ثبت شده است.
        </div>
      )}

      {day.columns.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="این روز برنامه‌ای ندارد"
            description={
              day.isClinicOpen
                ? "هیچ پرسنلی برای این روز شیفت ندارد و نوبتی هم ثبت نشده است."
                : "کلینیک این روز تعطیل است."
            }
          />
        </Card>
      ) : (
        <DayBoard
          columns={day.columns}
          fromMinute={day.fromMinute}
          toMinute={day.toMinute}
          stepMinutes={day.stepMinutes}
          nowMinute={nowMinute}
        />
      )}
    </>
  );
}
