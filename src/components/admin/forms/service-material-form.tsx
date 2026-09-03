"use client";

import { FlaskConical } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveServiceMaterial } from "@/app/actions/finance";

/**
 * «هر جلسه‌ی لیزر چقدر از چه چیزی مصرف می‌کند؟»
 * مبنای کسر خودکار انبار و محاسبه‌ی بهای تمام‌شده‌ی هر خدمت.
 */
export function ServiceMaterialForm({
  services,
  items,
}: {
  services: { id: string; title: string }[];
  items: { id: string; name: string; unit: string }[];
}) {
  return (
    <CrudDialog
      title="مصرف استاندارد یک خدمت"
      description="بعد از این، با ثبت هر جلسه‌ی درمان، این مقدار خودکار از انبار کم می‌شود."
      action={saveServiceMaterial}
      submitLabel="ثبت"
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          <FlaskConical className="size-4" />
          تعریف مصرف خدمت
        </Button>
      )}
    >
      {(errors) => (
        <>
          <Field label="خدمت" required error={errors.serviceId}>
            <Select name="serviceId" defaultValue="">
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

          <Field label="قلم انبار" required error={errors.itemId}>
            <Select name="itemId" defaultValue="">
              <option value="" disabled>
                انتخاب کنید...
              </option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="مقدار مصرف در هر جلسه"
            required
            error={errors.quantity}
            hint="مثلاً ۱ ویال یا ۰٫۵ سی‌سی"
          >
            <Input name="quantity" inputMode="decimal" dir="ltr" className="text-right" />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
