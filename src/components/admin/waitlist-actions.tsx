"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CalendarCheck, Loader2, Send, Trash2, Undo2, X } from "lucide-react";
import {
  deleteWaitlistEntry, notifyWaitlistEntry, setWaitlistStatus,
} from "@/app/actions/waitlist";

const BTN =
  "inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-50";

export function WaitlistActions({
  id,
  status,
  customerName,
}: {
  id: string;
  status: "WAITING" | "NOTIFIED" | "BOOKED" | "CANCELLED";
  customerName: string;
}) {
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>, confirm?: string) => () => {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  const open = status === "WAITING" || status === "NOTIFIED";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {pending && <Loader2 className="size-4 animate-spin text-rose-500" />}

      {open && (
        <button
          type="button"
          disabled={pending}
          onClick={run(
            () => notifyWaitlistEntry(id),
            `به ${customerName} پیامک «وقت خالی شد» ارسال شود؟`,
          )}
          className={BTN}
        >
          <Send className="size-3.5" />
          {status === "NOTIFIED" ? "پیامک دوباره" : "خبر بده"}
        </button>
      )}

      {open && (
        <button
          type="button"
          disabled={pending}
          onClick={run(() => setWaitlistStatus(id, "BOOKED"))}
          className={BTN}
        >
          <CalendarCheck className="size-3.5" />
          نوبت گرفت
        </button>
      )}

      {open && (
        <button
          type="button"
          disabled={pending}
          onClick={run(() => setWaitlistStatus(id, "CANCELLED"))}
          className={BTN}
        >
          <X className="size-3.5" />
          منصرف شد
        </button>
      )}

      {!open && (
        <button
          type="button"
          disabled={pending}
          onClick={run(() => setWaitlistStatus(id, "WAITING"))}
          className={BTN}
        >
          <Undo2 className="size-3.5" />
          برگرداندن به انتظار
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={run(() => deleteWaitlistEntry(id), "این درخواست حذف شود؟")}
        className={`${BTN} text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
