import "server-only";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { atTime, jalaliWeekday, minutesFromHHMM, parseYmdKey } from "./date";

export type DayBlock = {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  phone: string;
  serviceTitle: string;
  status: AppointmentStatus;
  note: string | null;
  adminNote: string | null;
  /** دقیقه از ابتدای شبانه‌روز */
  startMinute: number;
  endMinute: number;
  timeLabel: string;
  paidTotal: number;
  hasPaid: boolean;
  /** رضایت‌نامه‌ی مخصوص این خدمت را امضا نکرده است */
  needsConsent: string[];
};

export type DayOff = {
  id: string;
  reason: string | null;
  startMinute: number;
  endMinute: number;
};

export type DayColumn = {
  staffId: string;
  staffName: string;
  /** ساعت کاری این پرسنل در این روز */
  shiftStart: number | null;
  shiftEnd: number | null;
  blocks: DayBlock[];
  offs: DayOff[];
};

export type DaySchedule = {
  dateKey: string;
  date: Date;
  weekday: number;
  isClinicOpen: boolean;
  /** بازه‌ای که روی صفحه رسم می‌شود */
  fromMinute: number;
  toMinute: number;
  stepMinutes: number;
  columns: DayColumn[];
  totals: { appointments: number; done: number; cancelled: number; revenue: number };
};

const DEFAULT_FROM = 8 * 60;
const DEFAULT_TO = 21 * 60;

/** برنامه‌ی یک روز، ستون‌بندی‌شده بر اساس پرسنل — همان‌طور که میز پذیرش می‌بیند */
export async function buildDaySchedule(dateKey: string): Promise<DaySchedule> {
  const date = parseYmdKey(dateKey);
  const weekday = jalaliWeekday(date);
  const settings = await getSettings();
  const stepMinutes = Number(settings.slotStepMinutes) || 30;

  const dayStart = atTime(date, "00:00");
  const dayEnd = atTime(date, "23:59");

  const [clinicHour, staffList, appointments, offs] = await Promise.all([
    prisma.workingHour.findUnique({ where: { weekday } }),
    prisma.staff.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        order: true,
        schedules: { where: { weekday, isActive: true } },
      },
      orderBy: { order: "asc" },
    }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: dayStart, lte: dayEnd } },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        service: { select: { title: true } },
        payments: { where: { status: "PAID" }, select: { amount: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.timeOff.findMany({
      where: { from: { lte: dayEnd }, to: { gte: dayStart } },
      select: { id: true, staffId: true, from: true, to: true, reason: true },
    }),
  ]);

  // رضایت‌نامه‌های امضانشده‌ی مراجعین امروز — منشی باید پیش از شروع کار ببیند
  const needsConsentByAppointment = await unsignedConsentsForDay(appointments);

  const minutes = (d: Date, fallback: number) => {
    if (d < dayStart) return 0;
    if (d > dayEnd) return 24 * 60;
    return d.getHours() * 60 + d.getMinutes() || fallback;
  };

  // پرسنلی که آن روز شیفت دارند، به‌علاوه‌ی هرکسی که نوبتی برایش ثبت شده
  const busyStaffIds = new Set(appointments.map((a) => a.staffId).filter(Boolean) as string[]);
  const visible = staffList.filter((s) => s.schedules.length > 0 || busyStaffIds.has(s.id));

  const columns: DayColumn[] = visible.map((staff) => {
    const shift = staff.schedules[0];
    const staffOffs = offs.filter((o) => o.staffId === staff.id || o.staffId === null);

    return {
      staffId: staff.id,
      staffName: staff.name,
      shiftStart: shift ? minutesFromHHMM(shift.startTime) : null,
      shiftEnd: shift ? minutesFromHHMM(shift.endTime) : null,
      blocks: appointments
        .filter((a) => a.staffId === staff.id)
        .map((a) => {
          const paidTotal = a.payments.reduce((sum, p) => sum + p.amount, 0);
          const startMinute = a.startsAt.getHours() * 60 + a.startsAt.getMinutes();
          return {
            id: a.id,
            code: a.code,
            customerId: a.customer.id,
            customerName: `${a.customer.firstName} ${a.customer.lastName}`,
            phone: a.customer.phone,
            serviceTitle: a.service.title,
            status: a.status,
            note: a.note,
            adminNote: a.adminNote,
            startMinute,
            endMinute: Math.max(startMinute + 15, minutes(a.endsAt, startMinute + 30)),
            timeLabel: `${String(a.startsAt.getHours()).padStart(2, "0")}:${String(
              a.startsAt.getMinutes(),
            ).padStart(2, "0")}`,
            paidTotal,
            hasPaid: paidTotal > 0,
            needsConsent: needsConsentByAppointment.get(a.id) ?? [],
          };
        }),
      offs: staffOffs.map((o) => ({
        id: o.id,
        reason: o.reason,
        startMinute: o.from < dayStart ? 0 : o.from.getHours() * 60 + o.from.getMinutes(),
        endMinute: o.to > dayEnd ? 24 * 60 : o.to.getHours() * 60 + o.to.getMinutes(),
      })),
    };
  });

  // بازه‌ی نمایش را طوری می‌چینیم که هم شیفت‌ها و هم نوبت‌های بیرون از شیفت جا شوند
  const marks = [
    ...columns.flatMap((c) => [c.shiftStart, c.shiftEnd]),
    ...columns.flatMap((c) => c.blocks.flatMap((b) => [b.startMinute, b.endMinute])),
  ].filter((n): n is number => n !== null);

  const fromMinute = marks.length
    ? Math.max(0, Math.floor(Math.min(...marks, DEFAULT_FROM) / 60) * 60)
    : DEFAULT_FROM;
  const toMinute = marks.length
    ? Math.min(24 * 60, Math.ceil(Math.max(...marks, DEFAULT_TO) / 60) * 60)
    : DEFAULT_TO;

  const unassigned = appointments.filter((a) => !a.staffId);
  if (unassigned.length > 0) {
    columns.push({
      staffId: "__unassigned__",
      staffName: "بدون پرسنل",
      shiftStart: null,
      shiftEnd: null,
      offs: [],
      blocks: unassigned.map((a) => {
        const paidTotal = a.payments.reduce((sum, p) => sum + p.amount, 0);
        const startMinute = a.startsAt.getHours() * 60 + a.startsAt.getMinutes();
        return {
          id: a.id,
          code: a.code,
          customerId: a.customer.id,
          customerName: `${a.customer.firstName} ${a.customer.lastName}`,
          phone: a.customer.phone,
          serviceTitle: a.service.title,
          status: a.status,
          note: a.note,
          adminNote: a.adminNote,
          startMinute,
          endMinute: Math.max(startMinute + 15, minutes(a.endsAt, startMinute + 30)),
          timeLabel: `${String(a.startsAt.getHours()).padStart(2, "0")}:${String(
            a.startsAt.getMinutes(),
          ).padStart(2, "0")}`,
          paidTotal,
          hasPaid: paidTotal > 0,
          needsConsent: needsConsentByAppointment.get(a.id) ?? [],
        };
      }),
    });
  }

  return {
    dateKey,
    date,
    weekday,
    isClinicOpen: clinicHour ? clinicHour.isOpen : true,
    fromMinute,
    toMinute,
    stepMinutes,
    columns,
    totals: {
      appointments: appointments.length,
      done: appointments.filter((a) => a.status === "DONE").length,
      cancelled: appointments.filter((a) => a.status === "CANCELLED").length,
      revenue: appointments.reduce(
        (sum, a) => sum + a.payments.reduce((s, p) => s + p.amount, 0),
        0,
      ),
    },
  };
}

/**
 * برای هر نوبت روز، عنوان رضایت‌نامه‌هایی که مخصوص همان خدمت‌اند و مراجعه‌کننده
 * هنوز امضایشان نکرده. با سه کوئری ثابت انجام می‌شود، نه یکی به‌ازای هر نوبت.
 */
async function unsignedConsentsForDay(
  appointments: Array<{ id: string; customerId: string; serviceId: string }>,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (appointments.length === 0) return result;

  const serviceIds = [...new Set(appointments.map((a) => a.serviceId))];
  const customerIds = [...new Set(appointments.map((a) => a.customerId))];

  const links = await prisma.consentTemplateService.findMany({
    where: { serviceId: { in: serviceIds }, template: { isActive: true } },
    select: { serviceId: true, templateId: true, template: { select: { title: true } } },
  });
  if (links.length === 0) return result;

  const signatures = await prisma.consentSignature.findMany({
    where: { customerId: { in: customerIds }, templateId: { in: links.map((l) => l.templateId) } },
    select: { customerId: true, templateId: true },
  });
  const signed = new Set(signatures.map((s) => `${s.customerId}|${s.templateId}`));

  for (const appt of appointments) {
    const missing = links
      .filter((l) => l.serviceId === appt.serviceId)
      .filter((l) => !signed.has(`${appt.customerId}|${l.templateId}`))
      .map((l) => l.template.title);
    if (missing.length > 0) result.set(appt.id, [...new Set(missing)]);
  }

  return result;
}
