import "server-only";
import { prisma } from "./prisma";
import { jalaliWeekday, minutesFromHHMM, WEEKDAYS_FA } from "./date";
import type { ReportRange } from "./reports";

/**
 * نرخ اشغال: از ظرفیتی که داشتیم، چقدرش واقعاً پر شد.
 *
 * گزارش «شلوغی» می‌گفت کدام ساعت‌ها پرترددترند، ولی جواب سؤال مهم‌تر را
 * نمی‌داد: کجا ظرفیت داریم و هدر می‌رود؟ سه‌شنبه بعدازظهر ممکن است
 * «کم‌تردد» باشد چون کسی شیفت ندارد — که مشکل نیست — یا چون شیفت هست و
 * خالی می‌ماند — که پول از دست رفته است.
 *
 * ظرفیت از برنامه‌ی هفتگی پرسنل حساب می‌شود، منهای مرخصی‌ها.
 */

export type UtilizationCell = {
  weekday: number;
  label: string;
  /** دقیقه‌ی ظرفیت */
  capacity: number;
  /** دقیقه‌ی پرشده */
  booked: number;
  percent: number;
};

export type UtilizationHour = {
  hour: number;
  capacity: number;
  booked: number;
  percent: number;
};

export type StaffUtilization = {
  staffId: string;
  name: string;
  capacity: number;
  booked: number;
  percent: number;
};

export type Utilization = {
  capacity: number;
  booked: number;
  percent: number;
  byWeekday: UtilizationCell[];
  byHour: UtilizationHour[];
  byStaff: StaffUtilization[];
  /** بدترین بازه‌ها — جایی که بیشترین ظرفیت هدر می‌رود */
  worstSlots: { label: string; capacity: number; percent: number }[];
  /** آیا اصلاً برنامه‌ی هفتگی‌ای تعریف شده که بشود حساب کرد */
  hasSchedules: boolean;
};

/** هر روز از بازه، به‌همراه روز هفته‌اش */
function daysOf(range: ReportRange): Date[] {
  const out: Date[] = [];
  const cursor = new Date(range.from);
  cursor.setHours(12, 0, 0, 0);
  const end = new Date(range.to);
  // بازه‌های خیلی بلند («از ابتدا») را محدود می‌کنیم تا حلقه بی‌انتها نشود
  let guard = 0;
  while (cursor <= end && guard++ < 400) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function buildUtilization(range: ReportRange): Promise<Utilization> {
  const [schedules, appointments, timeOffs, clinicHours] = await Promise.all([
    prisma.staffSchedule.findMany({
      where: { isActive: true, staff: { isActive: true } },
      select: {
        staffId: true,
        weekday: true,
        startTime: true,
        endTime: true,
        staff: { select: { name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        startsAt: { gte: range.from, lte: range.to },
        status: { in: ["DONE", "CONFIRMED", "PENDING"] },
      },
      select: { staffId: true, startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({
      where: { from: { lte: range.to }, to: { gte: range.from } },
      select: { staffId: true, from: true, to: true },
    }),
    prisma.workingHour.findMany({ where: { isOpen: true }, select: { weekday: true } }),
  ]);

  const openWeekdays = new Set(clinicHours.map((h) => h.weekday));
  const hasSchedules = schedules.length > 0;

  const weekday = new Map<number, { capacity: number; booked: number }>();
  const hour = new Map<number, { capacity: number; booked: number }>();
  const staff = new Map<string, { name: string; capacity: number; booked: number }>();

  const addWeekday = (day: number, key: "capacity" | "booked", value: number) => {
    const row = weekday.get(day) ?? { capacity: 0, booked: 0 };
    row[key] += value;
    weekday.set(day, row);
  };
  const addHour = (h: number, key: "capacity" | "booked", value: number) => {
    const row = hour.get(h) ?? { capacity: 0, booked: 0 };
    row[key] += value;
    hour.set(h, row);
  };
  const addStaff = (id: string, name: string, key: "capacity" | "booked", value: number) => {
    const row = staff.get(id) ?? { name, capacity: 0, booked: 0 };
    row[key] += value;
    staff.set(id, row);
  };

  /* ── ظرفیت: برای هر روزِ بازه، شیفت‌های آن روز هفته ────────── */
  for (const day of daysOf(range)) {
    const jw = jalaliWeekday(day);
    if (openWeekdays.size > 0 && !openWeekdays.has(jw)) continue;

    for (const shift of schedules) {
      if (shift.weekday !== jw) continue;

      // مرخصی همان روز، ظرفیت را از بین می‌برد
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const off = timeOffs.some(
        (o) =>
          (o.staffId === shift.staffId || o.staffId === null) &&
          o.from <= dayEnd &&
          o.to >= dayStart,
      );
      if (off) continue;

      const start = minutesFromHHMM(shift.startTime);
      const end = minutesFromHHMM(shift.endTime);
      const minutes = Math.max(0, end - start);
      if (minutes === 0) continue;

      addWeekday(jw, "capacity", minutes);
      addStaff(shift.staffId, shift.staff.name, "capacity", minutes);
      for (let h = Math.floor(start / 60); h < Math.ceil(end / 60); h++) {
        const from = Math.max(start, h * 60);
        const to = Math.min(end, (h + 1) * 60);
        addHour(h, "capacity", Math.max(0, to - from));
      }
    }
  }

  /* ── پرشده: از روی نوبت‌های واقعی ─────────────────────────── */
  for (const appt of appointments) {
    const minutes = Math.max(
      0,
      Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000),
    );
    if (minutes === 0) continue;

    const jw = jalaliWeekday(appt.startsAt);
    addWeekday(jw, "booked", minutes);

    const start = appt.startsAt.getHours() * 60 + appt.startsAt.getMinutes();
    const end = start + minutes;
    for (let h = Math.floor(start / 60); h < Math.ceil(end / 60); h++) {
      const from = Math.max(start, h * 60);
      const to = Math.min(end, (h + 1) * 60);
      addHour(h, "booked", Math.max(0, to - from));
    }

    if (appt.staffId) {
      const known = staff.get(appt.staffId);
      addStaff(appt.staffId, known?.name ?? "نامشخص", "booked", minutes);
    }
  }

  const percentOf = (booked: number, capacity: number) =>
    capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;

  const byWeekday: UtilizationCell[] = WEEKDAYS_FA.map((label, index) => {
    const row = weekday.get(index) ?? { capacity: 0, booked: 0 };
    return {
      weekday: index,
      label,
      capacity: row.capacity,
      booked: row.booked,
      percent: percentOf(row.booked, row.capacity),
    };
  });

  const byHour: UtilizationHour[] = [...hour.entries()]
    .map(([h, row]) => ({
      hour: h,
      capacity: row.capacity,
      booked: row.booked,
      percent: percentOf(row.booked, row.capacity),
    }))
    .filter((row) => row.capacity > 0)
    .sort((a, b) => a.hour - b.hour);

  const byStaff: StaffUtilization[] = [...staff.entries()]
    .map(([staffId, row]) => ({
      staffId,
      name: row.name,
      capacity: row.capacity,
      booked: row.booked,
      percent: percentOf(row.booked, row.capacity),
    }))
    .filter((row) => row.capacity > 0)
    .sort((a, b) => a.percent - b.percent);

  // بدترین بازه‌ها: ظرفیت قابل‌توجه ولی پرشدن کم
  const worstSlots = byWeekday
    .filter((d) => d.capacity >= 120)
    .map((d) => ({ label: d.label, capacity: d.capacity, percent: d.percent }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 3);

  const capacity = byWeekday.reduce((sum, d) => sum + d.capacity, 0);
  const booked = byWeekday.reduce((sum, d) => sum + d.booked, 0);

  return {
    capacity,
    booked,
    percent: percentOf(booked, capacity),
    byWeekday: byWeekday.filter((d) => d.capacity > 0 || d.booked > 0),
    byHour,
    byStaff,
    worstSlots,
    hasSchedules,
  };
}

/** ساعت به شکل «۰۹:۰۰ تا ۱۰:۰۰» */
export function hourLabel(hour: number): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(hour)}:00 تا ${two(hour + 1)}:00`;
}
