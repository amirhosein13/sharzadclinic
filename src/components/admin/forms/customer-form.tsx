"use client";

import { Pencil, UserPlus } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveCustomer } from "@/app/actions/reception";
import { REFERRAL_SOURCES } from "@/lib/referral-sources";

export type CustomerFormValues = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  nationalCode: string | null;
  gender: string;
  birthDate: string | null;
  address: string | null;
  notes: string | null;
  allergies: string | null;
  referralSource: string | null;
  referralNote: string | null;
};

export function CustomerForm({ customer }: { customer?: CustomerFormValues }) {
  const editing = !!customer;

  return (
    <CrudDialog
      wide
      title={editing ? `ویرایش «${customer.firstName} ${customer.lastName}»` : "ثبت مشتری جدید"}
      description="برای وارد کردن پرونده‌های کاغذی، همه‌ی اطلاعات را همین‌جا ثبت کنید."
      action={saveCustomer}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت مشتری"}
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-3.5" />
            ویرایش اطلاعات
          </button>
        ) : (
          <Button onClick={open}>
            <UserPlus className="size-4" />
            ثبت مشتری جدید
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={customer.id} />}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="نام" required error={errors.firstName}>
              <Input name="firstName" defaultValue={customer?.firstName} autoFocus={!editing} />
            </Field>
            <Field label="نام خانوادگی" required error={errors.lastName}>
              <Input name="lastName" defaultValue={customer?.lastName} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="شماره موبایل" required error={errors.phone} hint="کلید یکتای هر مشتری">
              <Input
                name="phone"
                defaultValue={customer?.phone}
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                inputMode="tel"
                dir="ltr"
                className="text-right"
              />
            </Field>
            <Field label="جنسیت" error={errors.gender}>
              <Select name="gender" defaultValue={customer?.gender ?? "FEMALE"}>
                <option value="FEMALE">خانم</option>
                <option value="MALE">آقا</option>
                <option value="OTHER">سایر</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="کد ملی" error={errors.nationalCode} hint="اختیاری">
              <Input name="nationalCode" defaultValue={customer?.nationalCode ?? ""} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
            <Field label="تاریخ تولد" error={errors.birthDate} hint="شمسی، مثل ۱۳۷۰/۰۵/۱۲">
              <Input name="birthDate" defaultValue={customer?.birthDate ?? ""} placeholder="۱۳۷۰/۰۵/۱۲" dir="ltr" className="text-right" />
            </Field>
          </div>

          <Field label="ایمیل" error={errors.email} hint="اختیاری — برای ارسال تأیید نوبت">
            <Input name="email" type="email" defaultValue={customer?.email ?? ""} dir="ltr" className="text-right" />
          </Field>

          <Field label="آدرس" error={errors.address}>
            <Textarea name="address" rows={2} defaultValue={customer?.address ?? ""} />
          </Field>

          <Field
            label="حساسیت‌ها و نکات پزشکی"
            error={errors.allergies}
            hint="در پرونده‌ی مشتری با هشدار زرد نمایش داده می‌شود"
          >
            <Textarea name="allergies" rows={2} defaultValue={customer?.allergies ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="از کجا با ما آشنا شد؟"
              error={errors.referralSource}
              hint="برای اینکه بدانیم تبلیغات کجا جواب داده"
            >
              <Select name="referralSource" defaultValue={customer?.referralSource ?? ""}>
                <option value="">نپرسیدیم / نمی‌دانم</option>
                {REFERRAL_SOURCES.map((src) => (
                  <option key={src.key} value={src.key}>
                    {src.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="توضیح" error={errors.referralNote} hint="مثلاً نام معرف">
              <Input name="referralNote" defaultValue={customer?.referralNote ?? ""} />
            </Field>
          </div>

          <Field label="یادداشت پذیرش" error={errors.notes}>
            <Textarea name="notes" rows={3} defaultValue={customer?.notes ?? ""} />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
