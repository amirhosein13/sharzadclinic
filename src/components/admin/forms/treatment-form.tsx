"use client";

import { FilePlus2, Pencil } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveTreatment } from "@/app/actions/reception";
import { ImagePicker } from "@/components/admin/image-picker";

export type TreatmentFormValues = {
  id: string;
  serviceId: string | null;
  packageId: string | null;
  staffId: string | null;
  performedAt: string;
  sessionNo: number | null;
  description: string | null;
  beforePhoto: string | null;
  afterPhoto: string | null;
};

export function TreatmentForm({
  customerId,
  customerName,
  record,
  services,
  staff,
  packages = [],
}: {
  customerId: string;
  customerName: string;
  record?: TreatmentFormValues;
  services: { id: string; title: string }[];
  staff: { id: string; name: string }[];
  /** پکیج‌های فعال مشتری — جلسه از موجودی آن‌ها کم می‌شود */
  packages?: { id: string; label: string }[];
}) {
  const editing = !!record;

  return (
    <CrudDialog
      title={editing ? "ویرایش سابقه" : `ثبت سابقه‌ی مراجعه برای ${customerName}`}
      description="برای وارد کردن پرونده‌های کاغذی و مراجعات گذشته."
      action={saveTreatment}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت سابقه"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            aria-label="ویرایش سابقه"
            className="grid size-8 place-items-center rounded-lg border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : (
          <Button size="sm" variant="outline" onClick={open}>
            <FilePlus2 className="size-4" />
            ثبت سابقه‌ی مراجعه
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          <input type="hidden" name="customerId" value={customerId} />
          {editing && <input type="hidden" name="id" value={record.id} />}

          <Field
            label="تاریخ مراجعه"
            required
            error={errors.performedAt}
            hint="شمسی، مثل ۱۴۰۴/۰۳/۲۲"
          >
            <Input
              name="performedAt"
              defaultValue={record?.performedAt ?? ""}
              placeholder="۱۴۰۴/۰۳/۲۲"
              dir="ltr"
              className="text-right"
              autoFocus
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="خدمت" error={errors.serviceId}>
              <Select name="serviceId" defaultValue={record?.serviceId ?? ""}>
                <option value="">نامشخص</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="انجام‌دهنده" error={errors.staffId}>
              <Select name="staffId" defaultValue={record?.staffId ?? ""}>
                <option value="">نامشخص</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {packages.length > 0 && (
            <Field
              label="از کدام پکیج کم شود؟"
              error={errors.packageId}
              hint="اگر این جلسه بخشی از یک دوره‌ی خریداری‌شده است"
            >
              <Select name="packageId" defaultValue={record?.packageId ?? ""}>
                <option value="">هیچ‌کدام (جلسه‌ی مستقل)</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="شماره‌ی جلسه" error={errors.sessionNo} hint="مثلاً ۳ از یک دوره‌ی ۶ جلسه‌ای">
            <Input
              name="sessionNo"
              defaultValue={record?.sessionNo ?? ""}
              inputMode="numeric"
              dir="ltr"
              className="text-right"
            />
          </Field>

          <Field
            label="شرح جلسه"
            error={errors.description}
            hint="تنظیمات دستگاه، ناحیه، واکنش پوست، توصیه‌ها..."
          >
            <Textarea name="description" rows={4} defaultValue={record?.description ?? ""} />
          </Field>

          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-4">
            <p className="mb-1 text-sm font-medium">عکس قبل و بعد</p>
            <p className="mb-4 text-xs text-[color:var(--fg-muted)]">
              این عکس‌ها فقط در پرونده دیده می‌شوند؛ نه در سایت و نه با آدرس مستقیم.
              پیش از عکس گرفتن رضایت مشتری را بگیرید.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <ImagePicker
                name="beforePhoto"
                label="قبل"
                scope="private"
                aspect="aspect-[4/5]"
                defaultValue={record?.beforePhoto}
                hint=""
              />
              <ImagePicker
                name="afterPhoto"
                label="بعد"
                scope="private"
                aspect="aspect-[4/5]"
                defaultValue={record?.afterPhoto}
                hint=""
              />
            </div>
          </div>
        </>
      )}
    </CrudDialog>
  );
}
