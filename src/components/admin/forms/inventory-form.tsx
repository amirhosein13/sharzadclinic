"use client";

import { PackagePlus, Pencil } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveInventoryItem } from "@/app/actions/finance";

export type InventoryFormValues = {
  id: string;
  name: string;
  unit: string;
  minStock: number;
  unitCost: number;
  supplier: string | null;
  note: string | null;
  isActive: boolean;
};

export function InventoryForm({
  units,
  item,
}: {
  units: readonly string[];
  item?: InventoryFormValues;
}) {
  const editing = !!item;

  return (
    <CrudDialog
      title={editing ? `ویرایش «${item.name}»` : "قلم جدید انبار"}
      description="موجودی از ثبت خرید و مصرف به‌دست می‌آید، نه از این فرم."
      action={saveInventoryItem}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "افزودن به انبار"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            aria-label="ویرایش قلم"
            className="grid size-8 place-items-center rounded-lg border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : (
          <Button onClick={open}>
            <PackagePlus className="size-4" />
            قلم جدید
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={item.id} />}

          <Field label="نام" required error={errors.name} hint="مثل «ژل فیلر رستیلن» یا «سرسوزن ۳۰G»">
            <Input name="name" defaultValue={item?.name ?? ""} autoFocus />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="واحد" required error={errors.unit}>
              <Select name="unit" defaultValue={item?.unit ?? "عدد"}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="بهای هر واحد (تومان)"
              error={errors.unitCost}
              hint="مبنای محاسبه‌ی سود؛ با هر خرید به‌روز می‌شود"
            >
              <Input
                name="unitCost"
                defaultValue={item?.unitCost ?? ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="مرز هشدار"
              error={errors.minStock}
              hint="زیر این مقدار هشدار کمبود می‌گیرید"
            >
              <Input
                name="minStock"
                defaultValue={item?.minStock ?? ""}
                inputMode="decimal"
                dir="ltr"
                className="text-right"
              />
            </Field>
            <Field label="تأمین‌کننده" error={errors.supplier}>
              <Input name="supplier" defaultValue={item?.supplier ?? ""} />
            </Field>
          </div>

          <Field label="توضیح" error={errors.note}>
            <Textarea name="note" rows={2} defaultValue={item?.note ?? ""} />
          </Field>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--line)] p-4 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={item?.isActive ?? true}
              className="size-4 accent-rose-500"
            />
            فعال
          </label>
        </>
      )}
    </CrudDialog>
  );
}
