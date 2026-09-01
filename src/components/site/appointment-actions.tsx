"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, RefreshCw, X } from "lucide-react";
import { cancelMyAppointment } from "@/app/actions/customer";

export function AppointmentActions({
  id,
  startsAt,
  serviceTitle,
}: {
  id: string;
  startsAt: string;
  serviceTitle: string;
}) {
  const [pending, startTransition] = useTransition();

  const hoursLeft = (new Date(startsAt).getTime() - Date.now()) / 3_600_000;
  const canCancel = hoursLeft >= 6;

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/booking"
        className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3.5 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
      >
        <RefreshCw className="size-3.5" />
        رزرو مجدد
      </Link>

      <button
        type="button"
        disabled={pending || !canCancel}
        title={canCancel ? "لغو نوبت" : "لغو آنلاین تا ۶ ساعت قبل از نوبت ممکن است"}
        onClick={() => {
          if (!window.confirm(`نوبت «${serviceTitle}» لغو شود؟`)) return;
          startTransition(async () => {
            const result = await cancelMyAppointment(id);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3.5 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-400/25 dark:text-red-300 dark:hover:bg-red-500/10"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        لغو نوبت
      </button>
    </div>
  );
}
