"use client";

import { Wallet } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { recordPayment } from "@/app/actions/payroll";
import { formatToman } from "@/lib/utils";

const METHODS = [
  { value: "CASH", label: "نقدی" },
  { value: "CARD", label: "کارت‌خوان" },
  { value: "ONLINE", label: "آنلاین" },
  { value: "OTHER", label: "سایر" },
];

export function PaymentForm({
  appointmentId,
  code,
  serviceTitle,
  suggestedAmount,
  paidTotal,
}: {
  appointmentId: string;
  code: string;
  serviceTitle: string;
  suggestedAmount: number | null;
  paidTotal: number;
}) {
  return (
    <CrudDialog
      title={`ثبت پرداخت نوبت ${code}`}
      description={
        paidTotal > 0
          ? `تا الان ${formatToman(paidTotal)} برای این نوبت ثبت شده است.`
          : "مبلغ دریافتی مبنای محاسبه‌ی پورسانت پرسنل است."
      }
      action={recordPayment}
      submitLabel="ثبت پرداخت"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          title="ثبت پرداخت"
          className={
            paidTotal > 0
              ? "inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-400/25 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              : "inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
          }
        >
          <Wallet className="size-3.5" />
          {paidTotal > 0 ? formatToman(paidTotal, false) : "پرداخت"}
        </button>
      )}
    >
      {(errors) => (
        <>
          <input type="hidden" name="appointmentId" value={appointmentId} />

          <p className="rounded-2xl bg-[color:var(--bg-sunken)] p-3.5 text-sm">{serviceTitle}</p>

          <Field label="مبلغ دریافتی (تومان)" required error={errors.amount}>
            <Input
              name="amount"
              defaultValue={suggestedAmount ?? ""}
              inputMode="numeric"
              dir="ltr"
              className="text-right"
              autoFocus
            />
          </Field>

          <Field label="روش پرداخت" required error={errors.method}>
            <Select name="method" defaultValue="CASH">
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="شماره پیگیری" error={errors.reference} hint="اختیاری">
            <Input name="reference" dir="ltr" className="text-right" />
          </Field>

          <Field label="یادداشت" error={errors.note} hint="اختیاری">
            <Textarea name="note" rows={2} />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
