"use client";

import { ListPlus } from "lucide-react";
import { CrudDialog } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { saveTask } from "@/app/actions/duties";
import { toJalaliInput } from "@/lib/date";

/**
 * سپردن یک کارِ یک‌باره.
 *
 * فرق آن با «مسئولیت» عمدی است: مسئولیت قاعده است و تکرار می‌شود،
 * این یکی فقط همین یک‌بار. اگر هر دو در یک فرم بودند، مدیر مجبور
 * بود برای «فردا به خانم احمدی زنگ بزن» هم تکرار تعریف کند.
 *
 * کارِ یک‌باره هیچ‌وقت خودکار بسته نمی‌شود — چون کسی با قصد سپرده‌اش.
 */
export function TaskForm({
  users,
}: {
  users: { id: string; name: string; roleLabel: string }[];
}) {
  return (
    <CrudDialog
      title="سپردن یک کار"
      description="کاری که فقط همین یک‌بار باید انجام شود. در فهرست «کارهای امروز» آن نفر می‌آید."
      action={saveTask}
      submitLabel="بسپار"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--line)] px-5 text-sm font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <ListPlus className="size-4" />
          سپردن یک کار
        </button>
      )}
    >
      {(errors) => (
        <>
          <Field label="چه کاری؟" required error={errors.title}>
            <Input name="title" placeholder="به خانم احمدی زنگ بزن و نوبتش را جابه‌جا کن" />
          </Field>

          <Field label="توضیح" error={errors.note}>
            <Textarea name="note" rows={3} />
          </Field>

          <Field label="به چه کسی؟" required error={errors.assigneeId}>
            <Select name="assigneeId" defaultValue="">
              <option value="">انتخاب کنید...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.roleLabel}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="برای چه روزی؟"
            error={errors.dueOn}
            hint="شمسی. خالی بگذارید تا همین امروز باشد."
          >
            <Input
              name="dueOn"
              defaultValue={toJalaliInput(new Date())}
              dir="ltr"
              className="text-right"
            />
          </Field>
        </>
      )}
    </CrudDialog>
  );
}
