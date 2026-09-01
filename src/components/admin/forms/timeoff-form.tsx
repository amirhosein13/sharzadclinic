"use client";

import { CalendarOff } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveTimeOff } from "@/app/actions/reception";
import { ymdKey } from "@/lib/date";

export function TimeOffForm({ staff }: { staff: { id: string; name: string }[] }) {
  const today = ymdKey(new Date());

  return (
    <CrudDialog
      title="ثبت مرخصی یا تعطیلی"
      description="در این بازه نوبت آنلاین داده نمی‌شود. برای تعطیلی کل کلینیک، پرسنل را «همه» بگذارید."
      action={saveTimeOff}
      submitLabel="ثبت مرخصی"
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          <CalendarOff className="size-4" />
          مرخصی و تعطیلی
        </Button>
      )}
    >
      {(errors) => (
        <>
          <Field label="پرسنل" error={errors.staffId}>
            <Select name="staffId" defaultValue="">
              <option value="">همه (تعطیلی کل کلینیک)</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="از تاریخ" required error={errors.fromDate}>
              <Input name="fromDate" type="date" defaultValue={today} dir="ltr" />
            </Field>
            <Field label="تا تاریخ" required error={errors.toDate}>
              <Input name="toDate" type="date" defaultValue={today} dir="ltr" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="از ساعت" error={errors.fromTime} hint="خالی = از ابتدای روز">
              <Input name="fromTime" type="time" defaultValue="00:00" dir="ltr" />
            </Field>
            <Field label="تا ساعت" error={errors.toTime} hint="خالی = تا پایان روز">
              <Input name="toTime" type="time" defaultValue="23:59" dir="ltr" />
            </Field>
          </div>

          <Field label="علت" error={errors.reason} hint="اختیاری — مثلاً مرخصی، سفر، تعطیل رسمی">
            <Input name="reason" />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
