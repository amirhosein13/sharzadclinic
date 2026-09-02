"use client";

import { Package, Pencil } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { savePackage } from "@/app/actions/packages";

export type PackageFormValues = {
  id: string;
  serviceId: string;
  title: string;
  totalSessions: number;
  price: number;
  paidAmount: number;
  expiresAt: string | null;
  note: string | null;
};

export function PackageForm({
  customerId,
  customerName,
  services,
  pkg,
}: {
  customerId: string;
  customerName: string;
  services: { id: string; title: string }[];
  pkg?: PackageFormValues;
}) {
  const editing = !!pkg;

  return (
    <CrudDialog
      title={editing ? `ویرایش «${pkg.title}»` : `فروش پکیج به ${customerName}`}
      description="دوره‌ی چندجلسه‌ای که یکجا فروخته می‌شود. جلسات مصرف‌شده خودکار از سوابق شمرده می‌شوند."
      action={savePackage}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت پکیج"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            aria-label="ویرایش پکیج"
            className="grid size-8 place-items-center rounded-lg border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : (
          <Button size="sm" variant="outline" onClick={open}>
            <Package className="size-4" />
            فروش پکیج
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          <input type="hidden" name="customerId" value={customerId} />
          {editing && <input type="hidden" name="id" value={pkg.id} />}

          <Field label="خدمت" required error={errors.serviceId}>
            <Select name="serviceId" defaultValue={pkg?.serviceId ?? ""}>
              <option value="" disabled>
                انتخاب کنید...
              </option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="عنوان پکیج" error={errors.title} hint="خالی بگذارید تا از نام خدمت ساخته شود">
            <Input name="title" defaultValue={pkg?.title ?? ""} placeholder="دوره‌ی ۶ جلسه‌ای لیزر" />
          </Field>

          <Field label="تعداد جلسات" required error={errors.totalSessions}>
            <Input
              name="totalSessions"
              defaultValue={pkg?.totalSessions ?? 6}
              inputMode="numeric"
              dir="ltr"
              className="text-right"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="قیمت کل دوره (تومان)" required error={errors.price}>
              <Input
                name="price"
                defaultValue={pkg?.price ?? ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
            <Field label="مبلغ دریافتی تا الان" error={errors.paidAmount} hint="بقیه بعداً قسطی ثبت می‌شود">
              <Input
                name="paidAmount"
                defaultValue={pkg?.paidAmount ?? 0}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
          </div>

          <Field
            label="تاریخ انقضا"
            error={errors.expiresAt}
            hint="اختیاری — شمسی، مثل ۱۴۰۵/۱۲/۲۹. پس از این تاریخ جلسات باقی‌مانده منقضی می‌شوند."
          >
            <Input
              name="expiresAt"
              defaultValue={pkg?.expiresAt ?? ""}
              placeholder="۱۴۰۵/۱۲/۲۹"
              dir="ltr"
              className="text-right"
            />
          </Field>

          <Field label="یادداشت" error={errors.note}>
            <Textarea name="note" rows={2} defaultValue={pkg?.note ?? ""} />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
