"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { AppointmentStatus } from "@prisma/client";
import { updateAppointmentStatus } from "@/app/actions/admin";
import { STATUS_META, STATUS_ORDER } from "@/lib/appointment-status";

export function StatusSelect({ id, value }: { id: string; value: AppointmentStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as AppointmentStatus;
        startTransition(async () => {
          const result = await updateAppointmentStatus(id, next);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        });
      }}
      aria-label="تغییر وضعیت نوبت"
      className="cursor-pointer rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 py-2 text-xs font-medium transition-colors focus:border-rose-400 focus:outline-none disabled:opacity-50"
    >
      {STATUS_ORDER.map((status) => (
        <option key={status} value={status}>
          {STATUS_META[status].label}
        </option>
      ))}
    </select>
  );
}
