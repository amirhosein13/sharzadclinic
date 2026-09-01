"use client";

import { Pencil, Plus } from "lucide-react";
import { CrudDialog, Check } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveCategory } from "@/app/actions/content";

/** آیکون‌هایی که در صفحه‌ی اصلی برای دسته‌بندی‌ها پشتیبانی می‌شوند */
const ICONS = [
  { value: "Sparkles", label: "درخشش" },
  { value: "Zap", label: "لیزر" },
  { value: "Syringe", label: "تزریق" },
  { value: "TrendingUp", label: "لیفت" },
  { value: "Scissors", label: "مو" },
  { value: "Heart", label: "قلب" },
  { value: "Stethoscope", label: "پزشکی" },
  { value: "Gem", label: "الماس" },
];

export type CategoryFormValues = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
};

export function CategoryForm({ category }: { category?: CategoryFormValues }) {
  const editing = !!category;

  return (
    <CrudDialog
      title={editing ? `ویرایش «${category.title}»` : "افزودن دسته‌بندی"}
      action={saveCategory}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت دسته‌بندی"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            aria-label={`ویرایش ${category.title}`}
            className="grid size-8 place-items-center rounded-lg border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : (
          <Button variant="outline" onClick={open}>
            <Plus className="size-4" />
            دسته‌بندی جدید
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={category.id} />}

          <Field label="عنوان دسته‌بندی" required error={errors.title}>
            <Input name="title" defaultValue={category?.title} placeholder="مثلاً پوست و درمان" />
          </Field>

          <Field label="توضیح" error={errors.description}>
            <Textarea name="description" rows={3} defaultValue={category?.description ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="آیکون" error={errors.icon}>
              <Select name="icon" defaultValue={category?.icon ?? "Sparkles"}>
                {ICONS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ترتیب نمایش" error={errors.order}>
              <Input name="order" defaultValue={category?.order ?? 0} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
          </div>

          <Check name="isActive" label="فعال" defaultChecked={category?.isActive ?? true} />
        </>
      )}
    </CrudDialog>
  );
}
