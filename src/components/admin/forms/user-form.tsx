"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { CrudDialog, Check } from "@/components/admin/crud-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveUser } from "@/app/actions/users";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["ADMIN", "MANAGER", "RECEPTION", "OPERATOR"];

export type UserFormValues = {
  id: string;
  name: string;
  email: string;
  role: Role;
  staffId: string | null;
  isActive: boolean;
};

export function UserForm({
  user,
  staff,
}: {
  user?: UserFormValues;
  staff: { id: string; name: string }[];
}) {
  const editing = !!user;

  return (
    <CrudDialog
      title={editing ? `ویرایش «${user.name}»` : "افزودن کاربر"}
      description="هر کاربر با ایمیل و رمز عبور خودش وارد پنل می‌شود."
      action={saveUser}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ساخت کاربر"}
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
            افزودن کاربر
          </Button>
        )
      }
    >
      {(errors) => <Fields user={user} staff={staff} errors={errors} />}
    </CrudDialog>
  );
}

function Fields({
  user,
  staff,
  errors,
}: {
  user?: UserFormValues;
  staff: { id: string; name: string }[];
  errors: Record<string, string>;
}) {
  const [role, setRole] = useState<Role>(user?.role ?? "RECEPTION");

  return (
    <>
      {user && <input type="hidden" name="id" value={user.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="نام و نام خانوادگی" required error={errors.name}>
          <Input name="name" defaultValue={user?.name} />
        </Field>
        <Field label="ایمیل" required error={errors.email}>
          <Input name="email" type="email" defaultValue={user?.email} dir="ltr" className="text-right" />
        </Field>
      </div>

      <Field
        label="رمز عبور"
        error={errors.password}
        required={!user}
        hint={user ? "خالی بگذارید تا رمز فعلی تغییر نکند" : "حداقل ۸ کاراکتر"}
      >
        <Input name="password" type="password" autoComplete="new-password" dir="ltr" className="text-right" />
      </Field>

      <Field label="نقش" required error={errors.role}>
        <Select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>

      <p className="-mt-2 rounded-2xl bg-[color:var(--bg-sunken)] p-3.5 text-xs leading-6 text-[color:var(--fg-muted)]">
        {ROLE_DESCRIPTIONS[role]}
      </p>

      {role === "OPERATOR" && (
        <Field
          label="متصل به کدام پرسنل؟"
          required
          error={errors.staffId}
          hint="این کاربر فقط نوبت‌ها و درآمد همین پرسنل را می‌بیند"
        >
          <Select name="staffId" defaultValue={user?.staffId ?? ""}>
            <option value="">انتخاب کنید...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Check name="isActive" label="حساب فعال است" defaultChecked={user?.isActive ?? true} />
    </>
  );
}
