"use client";

import { Pencil, Receipt } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveExpense } from "@/app/actions/finance";

export type ExpenseFormValues = {
  id: string;
  categoryId: string;
  staffId: string | null;
  title: string;
  amount: number;
  spentAt: string;
  note: string | null;
};

export function ExpenseForm({
  categories,
  staff,
  expense,
  todayJalali,
}: {
  categories: { id: string; title: string }[];
  staff: { id: string; name: string }[];
  expense?: ExpenseFormValues;
  todayJalali: string;
}) {
  const editing = !!expense;

  return (
    <CrudDialog
      title={editing ? `ویرایش «${expense.title}»` : "ثبت هزینه‌ی جدید"}
      description="هر چیزی که از کلینیک خرج می‌شود — اجاره، حقوق، قبض، خرید دستگاه."
      action={saveExpense}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت هزینه"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            aria-label="ویرایش هزینه"
            className="grid size-8 place-items-center rounded-lg border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : (
          <Button onClick={open}>
            <Receipt className="size-4" />
            ثبت هزینه
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={expense.id} />}

          <Field label="عنوان" required error={errors.title} hint="مثل «اجاره‌ی شهریور» یا «قبض برق»">
            <Input name="title" defaultValue={expense?.title ?? ""} autoFocus />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="دسته" required error={errors.categoryId}>
              <Select name="categoryId" defaultValue={expense?.categoryId ?? ""}>
                <option value="" disabled>
                  انتخاب کنید...
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="مبلغ (تومان)" required error={errors.amount}>
              <Input
                name="amount"
                defaultValue={expense?.amount ?? ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="تاریخ" required error={errors.spentAt} hint="شمسی، مثل ۱۴۰۵/۰۶/۱۵">
              <Input
                name="spentAt"
                defaultValue={expense?.spentAt ?? todayJalali}
                dir="ltr"
                className="text-right"
              />
            </Field>
            <Field label="مربوط به پرسنل" error={errors.staffId} hint="برای حقوق و پاداش — اختیاری">
              <Select name="staffId" defaultValue={expense?.staffId ?? ""}>
                <option value="">هیچ‌کدام</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="توضیح" error={errors.note}>
            <Textarea name="note" rows={2} defaultValue={expense?.note ?? ""} />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
