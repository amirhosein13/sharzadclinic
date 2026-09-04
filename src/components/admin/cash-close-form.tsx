"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Lock, TriangleAlert } from "lucide-react";
import { submitCashClose } from "@/app/actions/cash";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatToman, toEn } from "@/lib/utils";

/**
 * شمارش کشو. تا وقتی عددی نزده‌اید اختلاف را زنده نشان می‌دهیم، تا اگر
 * اشتباه تایپی شد همان‌جا معلوم شود، نه بعد از ثبت.
 */
export function CashCloseForm({
  dateKey,
  expectedInDrawer,
  alreadyClosed,
}: {
  dateKey: string;
  expectedInDrawer: number;
  alreadyClosed: boolean;
}) {
  const [counted, setCounted] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const clean = toEn(counted).replace(/[,٬\s]/g, "");
  const parsed = clean === "" ? null : Number(clean);
  const valid = parsed !== null && Number.isFinite(parsed) && parsed >= 0;
  const diff = valid ? parsed - expectedInDrawer : null;

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await submitCashClose(formData);
      setState({ ok: result.ok, message: result.message });
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <input type="hidden" name="dateKey" value={dateKey} />

      <Field
        label="پول نقدی که در کشو شمردید"
        required
        hint="فقط اسکناس و سکه‌ی داخل کشو — کارت‌خوان و آنلاین را سیستم خودش می‌داند"
      >
        <Input
          name="countedCash"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          inputMode="numeric"
          placeholder="۰"
          dir="ltr"
          className="text-right text-lg"
        />
      </Field>

      {diff !== null && (
        <p
          className={
            diff === 0
              ? "flex items-center gap-2 rounded-2xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "flex items-center gap-2 rounded-2xl bg-amber-50 p-3.5 text-sm font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
          }
        >
          {diff === 0 ? (
            <>
              <CheckCircle2 className="size-4 shrink-0" />
              دقیقاً می‌خواند.
            </>
          ) : (
            <>
              <TriangleAlert className="size-4 shrink-0" />
              {diff > 0
                ? `${formatToman(diff)} بیشتر از انتظار در کشو است.`
                : `${formatToman(Math.abs(diff))} کسری دارید.`}
            </>
          )}
        </p>
      )}

      <Field label="توضیح" hint="اگر اختلافی هست، همین‌جا بنویسید چرا — بعداً یادتان نمی‌ماند">
        <Textarea name="note" rows={2} />
      </Field>

      {state && (
        <p
          className={
            state.ok
              ? "rounded-2xl bg-emerald-50 p-3.5 text-sm leading-7 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "rounded-2xl bg-red-50 p-3.5 text-sm leading-7 text-red-700 dark:bg-red-500/10 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending || !valid} className="w-full">
        <Lock className="size-4" />
        {pending ? "در حال ثبت..." : alreadyClosed ? "ثبت دوباره‌ی شمارش" : "بستن صندوق"}
      </Button>
    </form>
  );
}
