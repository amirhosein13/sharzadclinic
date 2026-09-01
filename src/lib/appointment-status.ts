import type { AppointmentStatus } from "@prisma/client";

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; tone: "amber" | "green" | "neutral" | "red" | "plum" }
> = {
  PENDING: { label: "در انتظار تأیید", tone: "amber" },
  CONFIRMED: { label: "تأیید شده", tone: "green" },
  DONE: { label: "انجام شده", tone: "plum" },
  CANCELLED: { label: "لغو شده", tone: "red" },
  NO_SHOW: { label: "عدم مراجعه", tone: "neutral" },
};

export const STATUS_ORDER: AppointmentStatus[] = [
  "PENDING", "CONFIRMED", "DONE", "CANCELLED", "NO_SHOW",
];
