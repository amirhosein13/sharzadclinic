"use client";

import { Hourglass } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { addToWaitlist } from "@/app/actions/waitlist";

export function WaitlistForm({
  customerId,
  customerName,
  services,
}: {
  customerId: string;
  customerName: string;
  services: { id: string; title: string }[];
}) {
  return (
    <CrudDialog
      title={`لیست انتظار برای ${customerName}`}
      description="اگر وقت دلخواهش خالی نیست، بازه‌ی مورد نظرش را ثبت کنید تا به‌محض خالی‌شدن خبرش کنیم."
      action={addToWaitlist}
      submitLabel="ثبت در لیست انتظار"
      trigger={(open) => (
        <Button size="sm" variant="outline" onClick={open}>
          <Hourglass className="size-4" />
          لیست انتظار
        </Button>
      )}
    >
      {(errors) => (
        <>
          <input type="hidden" name="customerId" value={customerId} />

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

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="از تاریخ" required error={errors.fromDate} hint="شمسی، مثل ۱۴۰۵/۰۶/۱۵">
              <Input name="fromDate" placeholder="۱۴۰۵/۰۶/۱۵" dir="ltr" className="text-right" />
            </Field>
            <Field label="تا تاریخ" required error={errors.toDate}>
              <Input name="toDate" placeholder="۱۴۰۵/۰۷/۰۱" dir="ltr" className="text-right" />
            </Field>
          </div>

          <Field label="توضیح" error={errors.note} hint="مثلاً «فقط عصرها» یا «ترجیحاً با خانم ...»">
            <Textarea name="note" rows={2} />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
