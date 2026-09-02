"use client";

import { useState } from "react";
import { Pencil, TicketPercent } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveDiscount } from "@/app/actions/discounts";

export type DiscountFormValues = {
  id: string;
  code: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  minAmount: number | null;
  maxDiscount: number | null;
  maxUses: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  note: string | null;
};

export function DiscountForm({ discount }: { discount?: DiscountFormValues }) {
  const [kind, setKind] = useState<"PERCENT" | "FIXED">(discount?.kind ?? "PERCENT");
  const editing = !!discount;

  return (
    <CrudDialog
      title={editing ? `ویرایش کد ${discount.code}` : "کد تخفیف جدید"}
      description="کد را به مشتری بدهید تا هنگام پرداخت بیعانه یا تسویه در کلینیک وارد کند."
      action={saveDiscount}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ساخت کد"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            aria-label="ویرایش کد"
            className="grid size-9 place-items-center rounded-lg border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-4" />
          </button>
        ) : (
          <Button onClick={open}>
            <TicketPercent className="size-4" />
            کد تخفیف جدید
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={discount.id} />}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="کد" required error={errors.code} hint="فقط حروف و عدد انگلیسی، مثل NOWRUZ1405">
              <Input
                name="code"
                defaultValue={discount?.code ?? ""}
                dir="ltr"
                className="text-right uppercase"
                autoFocus
              />
            </Field>
            <Field label="نوع تخفیف" required error={errors.kind}>
              <Select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "PERCENT" | "FIXED")}
              >
                <option value="PERCENT">درصدی</option>
                <option value="FIXED">مبلغ ثابت</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={kind === "PERCENT" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}
              required
              error={errors.value}
            >
              <Input
                name="value"
                defaultValue={discount?.value ?? ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
            {kind === "PERCENT" ? (
              <Field
                label="سقف تخفیف (تومان)"
                error={errors.maxDiscount}
                hint="خالی یعنی بدون سقف"
              >
                <Input
                  name="maxDiscount"
                  defaultValue={discount?.maxDiscount ?? ""}
                  inputMode="numeric"
                  dir="ltr"
                  className="text-right"
                />
              </Field>
            ) : (
              <input type="hidden" name="maxDiscount" value="" />
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="حداقل مبلغ خرید (تومان)" error={errors.minAmount} hint="خالی یعنی بدون شرط">
              <Input
                name="minAmount"
                defaultValue={discount?.minAmount ?? ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
            <Field
              label="سقف تعداد استفاده"
              error={errors.maxUses}
              hint="خالی یعنی نامحدود. هر مشتری در هر حال یک بار"
            >
              <Input
                name="maxUses"
                defaultValue={discount?.maxUses ?? ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="از تاریخ" error={errors.startsAt} hint="خالی یعنی از همین حالا">
              <Input
                name="startsAt"
                defaultValue={discount?.startsAt ?? ""}
                placeholder="۱۴۰۵/۰۱/۰۱"
                dir="ltr"
                className="text-right"
              />
            </Field>
            <Field label="تا تاریخ" error={errors.expiresAt} hint="خالی یعنی بدون انقضا">
              <Input
                name="expiresAt"
                defaultValue={discount?.expiresAt ?? ""}
                placeholder="۱۴۰۵/۰۱/۱۵"
                dir="ltr"
                className="text-right"
              />
            </Field>
          </div>

          <Field label="یادداشت" error={errors.note} hint="برای خودتان — مثلاً «کمپین نوروز»">
            <Textarea name="note" rows={2} defaultValue={discount?.note ?? ""} />
          </Field>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--line)] p-4 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={discount?.isActive ?? true}
              className="size-4 accent-rose-500"
            />
            فعال
          </label>
        </>
      )}
    </CrudDialog>
  );
}
