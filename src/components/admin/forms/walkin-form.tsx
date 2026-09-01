"use client";

import { CalendarPlus } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createWalkIn } from "@/app/actions/reception";
import { ymdKey } from "@/lib/date";

export function WalkInForm({
  customerId,
  customerName,
  services,
  staff,
  compact,
}: {
  customerId: string;
  customerName: string;
  services: { id: string; title: string }[];
  staff: { id: string; name: string }[];
  compact?: boolean;
}) {
  const today = ymdKey(new Date());

  return (
    <CrudDialog
      title={`ثبت نوبت برای ${customerName}`}
      description="برای مراجعین حضوری و تلفنی. محدودیت‌های رزرو آنلاین اینجا اعمال نمی‌شود، اما تداخل با نوبت‌های همان پرسنل بررسی می‌شود."
      action={createWalkIn}
      submitLabel="ثبت نوبت"
      trigger={(open) =>
        compact ? (
          <Button size="sm" variant="outline" onClick={open}>
            <CalendarPlus className="size-4" />
            ثبت نوبت
          </Button>
        ) : (
          <Button onClick={open}>
            <CalendarPlus className="size-4" />
            ثبت نوبت حضوری
          </Button>
        )
      }
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

          <Field label="انجام‌دهنده" error={errors.staffId} hint="اختیاری">
            <Select name="staffId" defaultValue="">
              <option value="">تعیین‌نشده</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="تاریخ" required error={errors.dateKey} hint="میلادی — تقویم مرورگر">
              <Input name="dateKey" type="date" defaultValue={today} dir="ltr" />
            </Field>
            <Field label="ساعت" required error={errors.time}>
              <Input name="time" type="time" defaultValue="10:00" dir="ltr" />
            </Field>
          </div>

          <Field label="وضعیت" error={errors.status}>
            <Select name="status" defaultValue="CONFIRMED">
              <option value="CONFIRMED">تأیید شده</option>
              <option value="PENDING">در انتظار تأیید</option>
              <option value="DONE">انجام شده (ثبت گذشته)</option>
            </Select>
          </Field>

          <Field label="یادداشت پذیرش" error={errors.adminNote}>
            <Textarea name="adminNote" rows={2} />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
