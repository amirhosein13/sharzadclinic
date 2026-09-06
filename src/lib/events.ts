/**
 * نام رویدادهای آمار سایت.
 *
 * جدا از `site-stats.ts` است چون آن فایل server-only است و ویزارد رزرو —
 * که کامپوننت کلاینت است — هم به این نام‌ها نیاز دارد.
 */
export const EVENTS = {
  serviceView: "service_view",
  bookingStart: "booking_start",
  bookingService: "booking_service",
  bookingTime: "booking_time",
  bookingDone: "booking_done",
} as const;

export type EventKind = (typeof EVENTS)[keyof typeof EVENTS];
