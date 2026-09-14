"use client";

import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { CrudDialog, Check, MultiCheck } from "@/components/admin/crud-dialog";
import { ImagePicker } from "@/components/admin/image-picker";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveStaff } from "@/app/actions/content";

export type StaffFormValues = {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  avatar: string | null;
  licenseNo: string | null;
  instagram: string | null;
  baseSalary: number;
  commissionPercent: number;
  order: number;
  isActive: boolean;
  acceptsBookings: boolean;
  serviceIds: string[];
};

export function StaffForm({
  member,
  services,
  canManageUsers = false,
}: {
  member?: StaffFormValues;
  services: { id: string; title: string }[];
  /** آیا بیننده اجازه‌ی ساخت حساب کاربری دارد؟ فقط مدیر کل دارد. */
  canManageUsers?: boolean;
}) {
  const editing = !!member;

  return (
    <CrudDialog
      wide
      title={editing ? `ویرایش «${member.name}»` : "افزودن پرسنل"}
      description="حقوق پایه و درصد پورسانت، مبنای محاسبه‌ی حقوق ماهانه است."
      action={saveStaff}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ثبت پرسنل"}
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
            افزودن پرسنل
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={member.id} />}

          {/*
            اولین سؤال هر کسی که این فرم را باز می‌کند این است: «پس رمز
            عبورش کو؟» — چون در ذهن، «پرسنل» و «کسی که وارد پنل می‌شود»
            یک چیزند. اینجا دو چیزند و فرم تا امروز این را نمی‌گفت.
          */}
          {!editing && (
            <p className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-4 text-xs leading-6 text-[color:var(--fg-muted)]">
              اینجا <b className="text-[color:var(--fg)]">پرونده‌ی کاری</b> این نفر ساخته می‌شود: روی سایت
              دیده می‌شود، نوبت می‌گیرد، و حقوق و پورسانتش از همین‌جا حساب می‌شود.
              <br />
              رمز عبور اینجا نیست، چون هر پرسنلی لازم نیست وارد پنل شود.{" "}
              {canManageUsers ? (
                <>
                  اگر می‌خواهی خودش هم وارد پنل شود و نوبت‌ها و درآمدش را ببیند، بعد از
                  ثبت، از بخش{" "}
                  <Link href="/admin/users" className="font-medium text-[color:var(--fg)] underline">
                    کاربران پنل
                  </Link>{" "}
                  برایش حساب با نقش «اپراتور / درمانگر» بساز و به همین نفر وصلش کن.
                </>
              ) : (
                <>
                  اگر می‌خواهی خودش هم وارد پنل شود، از مدیر کل بخواه از بخش «کاربران پنل»
                  برایش حساب با نقش «اپراتور / درمانگر» بسازد.
                </>
              )}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="نام و نام خانوادگی" required error={errors.name}>
              <Input name="name" defaultValue={member?.name} placeholder="دکتر شهرزاد امیری" />
            </Field>
            <Field label="سمت" required error={errors.title}>
              <Input name="title" defaultValue={member?.title} placeholder="متخصص پوست و مو" />
            </Field>
          </div>

          <Field label="معرفی" error={errors.bio}>
            <Textarea name="bio" rows={4} defaultValue={member?.bio ?? ""} />
          </Field>

          <ImagePicker name="avatar" label="عکس پرسنل" defaultValue={member?.avatar} aspect="aspect-square" />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="شماره نظام پزشکی" error={errors.licenseNo}>
              <Input name="licenseNo" defaultValue={member?.licenseNo ?? ""} />
            </Field>
            <Field label="اینستاگرام" error={errors.instagram} hint="آدرس کامل">
              <Input name="instagram" defaultValue={member?.instagram ?? ""} dir="ltr" className="text-right" />
            </Field>
          </div>

          <div className="grid gap-5 rounded-2xl bg-[color:var(--bg-sunken)] p-4 sm:grid-cols-2">
            <Field label="حقوق پایه‌ی ماهانه (تومان)" error={errors.baseSalary} hint="۰ یعنی فقط پورسانت">
              <Input name="baseSalary" defaultValue={member?.baseSalary ?? 0} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
            <Field label="درصد پورسانت" error={errors.commissionPercent} hint="از مبلغ خدمات انجام‌شده">
              <Input name="commissionPercent" defaultValue={member?.commissionPercent ?? 0} inputMode="numeric" dir="ltr" className="text-right" />
            </Field>
          </div>

          <MultiCheck
            name="serviceIds"
            label="خدماتی که انجام می‌دهد"
            options={services.map((s) => ({ id: s.id, label: s.title }))}
            selected={member?.serviceIds ?? []}
            emptyHint="اول از بخش خدمات، خدمات کلینیک را ثبت کنید."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Check name="isActive" label="فعال" defaultChecked={member?.isActive ?? true} />
            <Check
              name="acceptsBookings"
              label="پذیرش نوبت آنلاین"
              defaultChecked={member?.acceptsBookings ?? true}
              hint="در ویزارد رزرو نمایش داده شود"
            />
          </div>

          <Field label="ترتیب نمایش" error={errors.order}>
            <Input name="order" defaultValue={member?.order ?? 0} inputMode="numeric" dir="ltr" className="text-right" />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
