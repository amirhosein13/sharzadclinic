"use client";

import { FileText } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { savePayrollPeriod } from "@/app/actions/payroll";
import { formatJalaliLong } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export type PayrollLineView = {
  date: string;
  serviceTitle: string;
  customerName: string;
  amount: number;
  commissionPercent: number;
  commission: number;
  estimated: boolean;
};

export function PayrollForm({
  staffId,
  staffName,
  monthOffset,
  monthLabel,
  computed,
  saved,
  lines,
}: {
  staffId: string;
  staffName: string;
  monthOffset: number;
  monthLabel: string;
  computed: {
    baseSalary: number;
    commissionAmount: number;
    commissionBase: number;
    sessionCount: number;
  };
  saved?: { bonus: number; deduction: number; note: string | null };
  lines: PayrollLineView[];
}) {
  return (
    <CrudDialog
      wide
      title={`فیش حقوقی ${staffName}`}
      description={`دوره‌ی ${monthLabel}`}
      action={savePayrollPeriod}
      submitLabel={saved ? "به‌روزرسانی فیش" : "صدور فیش"}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <FileText className="size-3.5" />
          {saved ? "مشاهده و ویرایش فیش" : "صدور فیش"}
        </button>
      )}
    >
      {(errors) => (
        <>
          <input type="hidden" name="staffId" value={staffId} />
          <input type="hidden" name="monthOffset" value={monthOffset} />

          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[color:var(--bg-sunken)] p-4 sm:grid-cols-4">
            <Cell label="جلسات" value={toFa(computed.sessionCount)} />
            <Cell label="مبنای پورسانت" value={formatToman(computed.commissionBase)} />
            <Cell label="حقوق پایه" value={formatToman(computed.baseSalary)} />
            <Cell label="پورسانت" value={formatToman(computed.commissionAmount)} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="پاداش (تومان)" error={errors.bonus}>
              <Input
                name="bonus"
                defaultValue={saved?.bonus ?? 0}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
            <Field label="کسورات (تومان)" error={errors.deduction} hint="مساعده، جریمه، بیمه و...">
              <Input
                name="deduction"
                defaultValue={saved?.deduction ?? 0}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
          </div>

          <Field label="یادداشت" error={errors.note}>
            <Textarea name="note" rows={2} defaultValue={saved?.note ?? ""} />
          </Field>

          {lines.length > 0 && (
            <details className="rounded-2xl border border-[color:var(--line)]">
              <summary className="cursor-pointer p-4 text-sm font-medium">
                ریز جلسات ({toFa(lines.length)} مورد)
              </summary>
              <div className="max-h-72 overflow-y-auto border-t border-[color:var(--line)]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[color:var(--bg-sunken)] text-[color:var(--fg-muted)]">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">تاریخ</th>
                      <th className="px-3 py-2 text-right font-medium">خدمت</th>
                      <th className="px-3 py-2 text-right font-medium">مبلغ</th>
                      <th className="px-3 py-2 text-right font-medium">درصد</th>
                      <th className="px-3 py-2 text-right font-medium">پورسانت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--line)]">
                    {lines.map((line, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatJalaliLong(new Date(line.date))}
                        </td>
                        <td className="px-3 py-2">
                          {line.serviceTitle}
                          <span className="block text-[10px] text-[color:var(--fg-muted)]">
                            {line.customerName}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatToman(line.amount, false)}
                          {line.estimated && (
                            <span className="mr-1 text-[10px] text-amber-600 dark:text-amber-300">
                              (تخمینی)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{toFa(line.commissionPercent)}٪</td>
                        <td className="px-3 py-2 font-medium">{formatToman(line.commission, false)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </CrudDialog>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
