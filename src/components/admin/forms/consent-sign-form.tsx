"use client";

import { useState } from "react";
import { FileSignature } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { SignaturePad } from "@/components/admin/signature-pad";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { signConsent } from "@/app/actions/consents";

export type ConsentTemplateOption = {
  id: string;
  title: string;
  /** متن آماده‌شده با نام مشتری و تاریخ امروز، برای خواندن پیش از امضا */
  preview: string;
};

export function ConsentSignForm({
  customerId,
  customerName,
  nationalCode,
  templates,
}: {
  customerId: string;
  customerName: string;
  nationalCode?: string | null;
  templates: ConsentTemplateOption[];
}) {
  const [selected, setSelected] = useState(templates[0]?.id ?? "");
  const current = templates.find((t) => t.id === selected);

  return (
    <CrudDialog
      title={`رضایت‌نامه برای ${customerName}`}
      description="متن را با مراجعه‌کننده بخوانید، بعد امضا بگیرید. متن همین لحظه در سند ثبت می‌شود."
      action={signConsent}
      submitLabel="ثبت رضایت‌نامه"
      wide
      trigger={(open) => (
        <Button size="sm" variant="outline" onClick={open}>
          <FileSignature className="size-4" />
          گرفتن رضایت‌نامه
        </Button>
      )}
    >
      {(errors) => (
        <>
          <input type="hidden" name="customerId" value={customerId} />

          <Field label="نوع رضایت‌نامه" required error={errors.templateId}>
            <Select
              name="templateId"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="" disabled>
                انتخاب کنید...
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>

          {current && (
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-5 text-sm leading-8 whitespace-pre-wrap">
              {current.preview}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="نام و نام خانوادگی" required error={errors.fullName}>
              <Input name="fullName" defaultValue={customerName} />
            </Field>
            <Field label="کد ملی" error={errors.nationalCode} hint="اختیاری، ۱۰ رقم">
              <Input
                name="nationalCode"
                defaultValue={nationalCode ?? ""}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
          </div>

          <SignaturePad name="signatureData" />

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--line)] p-4 text-sm leading-7">
            <input type="checkbox" name="agreed" className="mt-1.5 size-4 accent-rose-500" />
            <span>
              متن بالا برای مراجعه‌کننده خوانده شد و ایشان با آگاهی کامل آن را می‌پذیرد.
              {errors.agreed && (
                <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors.agreed}</span>
              )}
            </span>
          </label>
        </>
      )}
    </CrudDialog>
  );
}
