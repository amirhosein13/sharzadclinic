"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { startDepositPayment } from "@/app/actions/payment";
import { formatToman } from "@/lib/utils";

export function DepositButton({
  appointmentId,
  amount,
}: {
  appointmentId: string;
  amount: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          // در مسیر موفق، اکشن به درگاه redirect می‌کند و اینجا چیزی برنمی‌گردد
          const result = await startDepositPayment(formData);
          if (result && !result.ok) toast.error(result.message);
        })
      }
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-gold-500 to-gold-400 px-3.5 py-2 text-xs font-medium text-plum-700 transition-all hover:brightness-105 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
        پرداخت بیعانه ({formatToman(amount, false)})
      </button>
    </form>
  );
}
