import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { atTime, jalaliWeekday, minutesFromHHMM, hhmmFromMinutes, parseYmdKey } from "./date";
import { toFa } from "./utils";

export type Slot = {
  /** «09:30» */
  time: string;
  /** برچسب فارسی برای نمایش */
  label: string;
  /** ISO زمان شروع */
  startsAt: string;
  staffId: string;
  staffName: string;
};

type Interval = { start: number; end: number };

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * نوبت‌های خالی یک روز را برای یک خدمت محاسبه می‌کند.
 * اگر `staffId` داده نشود، همه‌ی پرسنلِ مجاز برای آن خدمت بررسی می‌شوند.
 */
export async function getAvailableSlots(params: {
  serviceId: string;
  dateKey: string; // «2026-09-01»
  staffId?: string | null;
}): Promise<Slot[]> {
  const { serviceId, dateKey, staffId } = params;

  const settings = await getSettings();
  const step = Number(settings.slotStepMinutes) || 30;
  const leadMinutes = (Number(settings.bookingLeadHours) || 3) * 60;
  const horizonDays = Number(settings.bookingHorizonDays) || 45;

  const day = parseYmdKey(dateKey);
  if (Number.isNaN(day.getTime())) return [];

  // خارج از بازه‌ی مجاز رزرو
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const maxDay = new Date(todayMidnight);
  maxDay.setDate(maxDay.getDate() + horizonDays);
  if (day < todayMidnight || day > maxDay) return [];

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, durationMinutes: true, bufferMinutes: true, isBookable: true, isActive: true },
  });
  if (!service || !service.isBookable || !service.isActive) return [];

  const weekday = jalaliWeekday(day);

  // ساعات کاری خود کلینیک
  const clinicHour = await prisma.workingHour.findUnique({ where: { weekday } });
  if (clinicHour && !clinicHour.isOpen) return [];
  const clinicWindow: Interval = {
    start: minutesFromHHMM(clinicHour?.startTime ?? "09:00"),
    end: minutesFromHHMM(clinicHour?.endTime ?? "21:00"),
  };

  // پرسنلی که این خدمت را انجام می‌دهند
  const staffList = await prisma.staff.findMany({
    where: {
      isActive: true,
      acceptsBookings: true,
      ...(staffId ? { id: staffId } : {}),
      services: { some: { serviceId } },
    },
    select: {
      id: true,
      name: true,
      schedules: { where: { weekday, isActive: true } },
    },
    orderBy: { order: "asc" },
  });
  if (staffList.length === 0) return [];

  const dayStart = atTime(day, "00:00");
  const dayEnd = atTime(day, "23:59");
  const staffIds = staffList.map((s) => s.id);

  const [booked, timeOffs] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        staffId: { in: staffIds },
        status: { in: ["PENDING", "CONFIRMED"] },
        startsAt: { lte: dayEnd },
        endsAt: { gte: dayStart },
      },
      select: { staffId: true, startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({
      where: {
        OR: [{ staffId: { in: staffIds } }, { staffId: null }],
        from: { lte: dayEnd },
        to: { gte: dayStart },
      },
      select: { staffId: true, from: true, to: true },
    }),
  ]);

  const toMinutes = (d: Date) => {
    if (d < dayStart) return -10000;
    if (d > dayEnd) return 10000;
    return d.getHours() * 60 + d.getMinutes();
  };

  const busyByStaff = new Map<string, Interval[]>();
  for (const id of staffIds) busyByStaff.set(id, []);
  for (const appt of booked) {
    if (!appt.staffId) continue;
    busyByStaff.get(appt.staffId)?.push({ start: toMinutes(appt.startsAt), end: toMinutes(appt.endsAt) });
  }
  for (const off of timeOffs) {
    const interval = { start: toMinutes(off.from), end: toMinutes(off.to) };
    if (off.staffId) busyByStaff.get(off.staffId)?.push(interval);
    else for (const id of staffIds) busyByStaff.get(id)?.push(interval);
  }

  const earliestAllowed = (() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + leadMinutes * 60_000);
    if (cutoff < dayStart) return -Infinity;
    if (cutoff > dayEnd) return Infinity;
    return cutoff.getHours() * 60 + cutoff.getMinutes();
  })();

  const total = service.durationMinutes + service.bufferMinutes;
  const seen = new Map<string, Slot>();

  for (const staff of staffList) {
    // اگر برنامه‌ی هفتگی ثبت نشده باشد، پرسنل آن روز در دسترس نیست
    for (const sched of staff.schedules) {
      const windowStart = Math.max(minutesFromHHMM(sched.startTime), clinicWindow.start);
      const windowEnd = Math.min(minutesFromHHMM(sched.endTime), clinicWindow.end);

      // شروع را به مضرب گام گرد می‌کنیم
      let cursor = Math.ceil(windowStart / step) * step;

      for (; cursor + total <= windowEnd; cursor += step) {
        if (cursor < earliestAllowed) continue;

        const candidate: Interval = { start: cursor, end: cursor + total };
        const busy = busyByStaff.get(staff.id) ?? [];
        if (busy.some((b) => overlaps(candidate, b))) continue;

        const time = hhmmFromMinutes(cursor);
        if (seen.has(time)) continue; // اولین پرسنلِ آزاد برنده است

        seen.set(time, {
          time,
          label: toFa(time),
          startsAt: atTime(day, time).toISOString(),
          staffId: staff.id,
          staffName: staff.name,
        });
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * برای هر روزِ یک بازه مشخص می‌کند که اصلاً نوبت خالی دارد یا نه
 * (برای رنگ‌کردن تقویم استفاده می‌شود).
 */
export async function getDayAvailabilityMap(params: {
  serviceId: string;
  dateKeys: string[];
  staffId?: string | null;
}): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    params.dateKeys.map(async (dateKey) => {
      const slots = await getAvailableSlots({ ...params, dateKey });
      return [dateKey, slots.length > 0] as const;
    })
  );
  return Object.fromEntries(entries);
}
