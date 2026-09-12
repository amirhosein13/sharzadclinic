"use client";

import { Pencil, Plus } from "lucide-react";
import { CrudDialog, Check } from "@/components/admin/crud-dialog";
import { ImagePicker } from "@/components/admin/image-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { savePost } from "@/app/actions/content";

export type PostFormValues = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  categoryId: string | null;
  isPublished: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
};

export function PostForm({
  post,
  categories,
}: {
  post?: PostFormValues;
  categories: { id: string; title: string }[];
}) {
  const editing = !!post;

  return (
    <CrudDialog
      wide
      title={editing ? `ویرایش «${post.title}»` : "نوشتن مقاله جدید"}
      description="با دکمه‌های بالای کادر متن را شکل بده، و با «پیش‌نمایش» ببین روی سایت چطور در می‌آید."
      action={savePost}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت مقاله"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-3.5" />
            ویرایش
          </button>
        ) : (
          <Button onClick={open}>
            <Plus className="size-4" />
            مقاله جدید
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={post.id} />}

          <Field label="عنوان مقاله" required error={errors.title}>
            <Input name="title" defaultValue={post?.title} />
          </Field>

          <Field label="خلاصه" error={errors.excerpt} hint="در کارت مقاله و نتایج گوگل دیده می‌شود">
            <Textarea name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} />
          </Field>

          <ImagePicker name="coverImage" label="تصویر شاخص" defaultValue={post?.coverImage} />

          <Field label="متن مقاله" required error={errors.content}>
            <RichTextEditor name="content" defaultValue={post?.content ?? ""} rows={16} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="دسته‌بندی" error={errors.categoryId}>
              <Select name="categoryId" defaultValue={post?.categoryId ?? ""}>
                <option value="">بدون دسته‌بندی</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Check
              name="isPublished"
              label="منتشر شود"
              defaultChecked={post?.isPublished ?? false}
              hint="بدون تیک، پیش‌نویس می‌ماند"
            />
          </div>

          <details className="rounded-2xl border border-[color:var(--line)] p-4">
            <summary className="cursor-pointer text-sm font-medium">تنظیمات سئو (اختیاری)</summary>
            <div className="mt-4 space-y-4">
              <Field label="عنوان سئو" error={errors.metaTitle} hint="خالی بگذارید تا از عنوان مقاله استفاده شود">
                <Input name="metaTitle" defaultValue={post?.metaTitle ?? ""} />
              </Field>
              <Field label="توضیح سئو" error={errors.metaDescription}>
                <Textarea name="metaDescription" rows={2} defaultValue={post?.metaDescription ?? ""} />
              </Field>
            </div>
          </details>
        </>
      )}
    </CrudDialog>
  );
}
