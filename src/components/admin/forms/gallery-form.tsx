"use client";

import { Pencil, Plus } from "lucide-react";
import { CrudDialog, Check } from "@/components/admin/crud-dialog";
import { ImagePicker } from "@/components/admin/image-picker";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveGalleryItem } from "@/app/actions/content";

export type GalleryFormValues = {
  id: string;
  title: string;
  description: string | null;
  beforeImage: string;
  afterImage: string | null;
  serviceSlug: string | null;
  order: number;
  isPublished: boolean;
};

export function GalleryForm({
  item,
  services,
}: {
  item?: GalleryFormValues;
  services: { slug: string; title: string }[];
}) {
  const editing = !!item;

  return (
    <CrudDialog
      title={editing ? `ویرایش «${item.title}»` : "افزودن نمونه‌کار"}
      description="تصویر «قبل» الزامی است. با افزودن تصویر «بعد»، اسلایدر مقایسه فعال می‌شود."
      action={saveGalleryItem}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت نمونه‌کار"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-3.5" />
            ویرایش
          </button>
        ) : (
          <Button onClick={open}>
            <Plus className="size-4" />
            افزودن نمونه‌کار
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={item.id} />}

          <Field label="عنوان" required error={errors.title}>
            <Input name="title" defaultValue={item?.title} placeholder="مثلاً لیزر موهای زائد صورت" />
          </Field>

          <Field label="توضیح" error={errors.description} hint="مثلاً «پس از ۶ جلسه، با فاصله‌ی ۴ هفته»">
            <Textarea name="description" rows={2} defaultValue={item?.description ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <ImagePicker name="beforeImage" label="تصویر قبل *" defaultValue={item?.beforeImage} aspect="aspect-square" />
            <ImagePicker name="afterImage" label="تصویر بعد" defaultValue={item?.afterImage} aspect="aspect-square" />
          </div>
          {errors.beforeImage && <p className="-mt-3 text-xs text-red-600">{errors.beforeImage}</p>}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="مربوط به خدمت" error={errors.serviceSlug} hint="برای فیلتر در صفحه‌ی گالری">
              <Select name="serviceSlug" defaultValue={item?.serviceSlug ?? ""}>
                <option value="">بدون دسته‌بندی</option>
                {services.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ترتیب نمایش" error={errors.order}>
              <Input name="order" defaultValue={item?.order ?? 0} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
          </div>

          <Check
            name="isPublished"
            label="منتشرشده"
            defaultChecked={item?.isPublished ?? true}
            hint="در صفحه‌ی نمونه کارها نمایش داده شود"
          />
        </>
      )}
    </CrudDialog>
  );
}
