"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateServicePricing } from "@/app/actions/admin";
import { toEn } from "@/lib/utils";

export function ServicePricingForm({
  id,
  priceFrom,
  priceTo,
  durationMinutes,
}: {
  id: string;
  priceFrom: number | null;
  priceTo: number | null;
  durationMinutes: number;
}) {
  const [from, setFrom] = useState(priceFrom?.toString() ?? "");
  const [to, setTo] = useState(priceTo?.toString() ?? "");
  const [duration, setDuration] = useState(durationMinutes.toString());
  const [pending, startTransition] = useTransition();

  const dirty =
    from !== (priceFrom?.toString() ?? "") ||
    to !== (priceTo?.toString() ?? "") ||
    duration !== durationMinutes.toString();

  function save() {
    const parsedDuration = Number(toEn(duration));
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      toast.error("مدت جلسه باید عددی مثبت باشد.");
      return;
    }
    startTransition(async () => {
      const result = await updateServicePricing(id, {
        priceFrom: from.trim() === "" ? null : Number(toEn(from)),
        priceTo: to.trim() === "" ? null : Number(toEn(to)),
        durationMinutes: parsedDuration,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <NumberField label="از (تومان)" value={from} onChange={setFrom} placeholder="۲۵۰۰۰۰" />
      <NumberField label="تا (تومان)" value={to} onChange={setTo} placeholder="اختیاری" />
      <div>
        <label className="mb-1 block text-[10px] text-[color:var(--fg-muted)]">مدت (دقیقه)</label>
        <div className="flex gap-1">
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            inputMode="numeric"
            dir="ltr"
            className="w-full min-w-0 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-2 py-1.5 text-right text-xs focus:border-rose-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            title="ذخیره"
            aria-label="ذخیره‌ی قیمت و مدت"
            className="grid size-8 shrink-0 place-items-center rounded-xl bg-rose-500 text-white transition-colors hover:bg-rose-600 disabled:opacity-40"
          >
            <Save className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] text-[color:var(--fg-muted)]">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        dir="ltr"
        className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-2 py-1.5 text-right text-xs focus:border-rose-400 focus:outline-none"
      />
    </div>
  );
}
