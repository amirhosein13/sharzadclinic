"use client";

import { Pencil, Plus } from "lucide-react";
import { CrudDialog, Check, MultiCheck } from "@/components/admin/crud-dialog";
import { ImagePicker } from "@/components/admin/image-picker";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveService } from "@/app/actions/content";

export type ServiceFormValues = {
  id: string;
  title: string;
  categoryId: string;
  shortDescription: string | null;
  description: string | null;
  image: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  durationMinutes: number;
  bufferMinutes: number;
  slotStepMinutes: number | null;
  depositAmount: number | null;
  followUpDays: number;
  sessionsNeeded: string | null;
  preparation: string | null;
  aftercare: string | null;
  isFeatured: boolean;
  isBookable: boolean;
  isActive: boolean;
  order: number;
  staffIds: string[];
};

export function ServiceForm({
  service,
  categories,
  staff,
}: {
  service?: ServiceFormValues;
  categories: { id: string; title: string }[];
  staff: { id: string; name: string }[];
}) {
  const editing = !!service;

  return (
    <CrudDialog
      wide
      title={editing ? `ویرایش «${service.title}»` : "افزودن خدمت جدید"}
      description="قیمت‌ها به تومان و زمان‌ها به دقیقه وارد شوند."
      action={saveService}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت خدمت"}
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
            افزودن خدمت
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={service.id} />}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="عنوان خدمت" required error={errors.title}>
              <Input name="title" defaultValue={service?.title} placeholder="مثلاً لیزر موهای زائد" />
            </Field>
            <Field label="دسته‌بندی" required error={errors.categoryId}>
              <Select name="categoryId" defaultValue={service?.categoryId}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="توضیح کوتاه" error={errors.shortDescription} hint="زیر عنوان در کارت خدمت نمایش داده می‌شود">
            <Textarea name="shortDescription" rows={2} defaultValue={service?.shortDescription ?? ""} />
          </Field>

          <Field
            label="توضیح کامل"
            error={errors.description}
            hint="برای عنوان از ‎## و برای فهرست از ‎- استفاده کنید. خط خالی یعنی پاراگراف جدید."
          >
            <Textarea name="description" rows={8} defaultValue={service?.description ?? ""} />
          </Field>

          <ImagePicker name="image" label="تصویر خدمت" defaultValue={service?.image} />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="حداقل قیمت (تومان)" error={errors.priceFrom} hint="۰ یعنی رایگان، خالی یعنی استعلامی">
              <Input name="priceFrom" defaultValue={service?.priceFrom ?? ""} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
            <Field label="حداکثر قیمت (تومان)" error={errors.priceTo} hint="اختیاری">
              <Input name="priceTo" defaultValue={service?.priceTo ?? ""} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="مدت جلسه (دقیقه)" required error={errors.durationMinutes}>
              <Input name="durationMinutes" defaultValue={service?.durationMinutes ?? 60} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
            <Field label="فاصله تا نوبت بعد" error={errors.bufferMinutes} hint="دقیقه">
              <Input name="bufferMinutes" defaultValue={service?.bufferMinutes ?? 10} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
            <Field label="گام ساعت‌ها" error={errors.slotStepMinutes} hint="خالی = تنظیم عمومی">
              <Input name="slotStepMinutes" defaultValue={service?.slotStepMinutes ?? ""} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
          </div>

          <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-4">
            <Field
              label="مبلغ رزرو / بیعانه (تومان)"
              error={errors.depositAmount}
              hint="اگر عددی بگذارید، نوبت آنلاین فقط پس از پرداخت همین مبلغ قطعی می‌شود و تا ۱۵ دقیقه برای مشتری نگه داشته می‌شود. خالی = استفاده از درصد عمومی تنظیمات. صفر = بدون بیعانه."
            >
              <Input
                name="depositAmount"
                defaultValue={service?.depositAmount ?? ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
                placeholder="مثلاً ۲۰۰۰۰۰"
              />
            </Field>
          </div>

          <Field
            label="پیگیری پس از درمان (روز)"
            error={errors.followUpDays}
            hint="مثلاً ۳ یعنی سه روز بعد از هر جلسه، پیگیری «حالتان چطور است؟» در فهرست منشی می‌آید. صفر یا خالی = خاموش"
          >
            <Input
              name="followUpDays"
              defaultValue={service?.followUpDays ?? ""}
              inputMode="numeric"
              dir="ltr"
              className="text-right"
            />
          </Field>

          <Field label="تعداد جلسات پیشنهادی" error={errors.sessionsNeeded} hint="مثلاً «۴ تا ۸ جلسه»">
            <Input name="sessionsNeeded" defaultValue={service?.sessionsNeeded ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="آمادگی قبل از مراجعه" error={errors.preparation}>
              <Textarea name="preparation" rows={3} defaultValue={service?.preparation ?? ""} />
            </Field>
            <Field label="مراقبت‌های بعد از جلسه" error={errors.aftercare}>
              <Textarea name="aftercare" rows={3} defaultValue={service?.aftercare ?? ""} />
            </Field>
          </div>

          <MultiCheck
            name="staffIds"
            label="پرسنلی که این خدمت را انجام می‌دهند"
            options={staff.map((s) => ({ id: s.id, label: s.name }))}
            selected={service?.staffIds ?? []}
            emptyHint="اول از بخش پرسنل، همکاران را ثبت کنید."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Check name="isActive" label="فعال" defaultChecked={service?.isActive ?? true} hint="روی سایت نمایش داده شود" />
            <Check name="isBookable" label="قابل رزرو آنلاین" defaultChecked={service?.isBookable ?? true} />
            <Check name="isFeatured" label="خدمت منتخب" defaultChecked={service?.isFeatured ?? false} hint="در صفحه‌ی اصلی دیده می‌شود" />
            <Field label="ترتیب نمایش" error={errors.order}>
              <Input name="order" defaultValue={service?.order ?? 0} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
          </div>
        </>
      )}
    </CrudDialog>
  );
}
