"use client";

import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { saveStockMovement } from "@/app/actions/finance";
import { toFa } from "@/lib/utils";

type Kind = "IN" | "OUT" | "ADJUST" | "WASTE";

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "IN", label: "خرید / ورود", hint: "مقدار اضافه‌شده به موجودی" },
  { value: "OUT", label: "مصرف", hint: "مقدار برداشته‌شده از موجودی" },
  { value: "ADJUST", label: "اصلاح شمارش", hint: "موجودیِ واقعی پس از شمارش انبار" },
  { value: "WASTE", label: "ضایعات", hint: "مقداری که خراب یا دور ریخته شد" },
];

export function StockForm({
  itemId,
  itemName,
  unit,
  stock,
  unitCost,
}: {
  itemId: string;
  itemName: string;
  unit: string;
  stock: number;
  unitCost: number;
}) {
  const [kind, setKind] = useState<Kind>("IN");
  const meta = KINDS.find((k) => k.value === kind)!;

  return (
    <CrudDialog
      title={`ثبت حرکت انبار — ${itemName}`}
      description={`موجودی فعلی: ${toFa(stock)} ${unit}`}
      action={saveStockMovement}
      submitLabel="ثبت"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          title="ثبت خرید یا مصرف"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <ArrowDownUp className="size-3.5" />
          خرید / مصرف
        </button>
      )}
    >
      {(errors) => (
        <>
          <input type="hidden" name="itemId" value={itemId} />

          <Field label="نوع حرکت" required error={errors.kind}>
            <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={`مقدار (${unit})`} required error={errors.quantity} hint={meta.hint}>
            <Input name="quantity" inputMode="decimal" dir="ltr" className="text-right" autoFocus />
          </Field>

          {kind === "IN" ? (
            <Field
              label="بهای هر واحد (تومان)"
              error={errors.unitCost}
              hint="خالی یعنی همان بهای قبلی. این مبلغ خودکار به هزینه‌ها اضافه می‌شود"
            >
              <Input
                name="unitCost"
                defaultValue={unitCost || ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
          ) : (
            <input type="hidden" name="unitCost" value="" />
          )}

          <Field label="توضیح" error={errors.note}>
            <Textarea name="note" rows={2} placeholder="مثلاً «خرید از نمایندگی»" />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
