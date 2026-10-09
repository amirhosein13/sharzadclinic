"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { CrudDialog, Check } from "@/components/admin/crud-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveDuty } from "@/app/actions/duties";
import { WEEKDAYS_FA } from "@/lib/date";
import { cn, toFa } from "@/lib/utils";
import type { DutyRepeat } from "@prisma/client";

export type DutyFormValues = {
  id: string;
  title: string;
  note: string | null;
  assigneeId: string;
  repeat: DutyRepeat;
  weekdays: number[];
  monthDay: number | null;
  timeHint: string | null;
  isActive: boolean;
};

const REPEATS: { value: DutyRepeat; label: string; hint: string }[] = [
  { value: "DAILY", label: "هر روز", hint: "هر روزی که کلینیک باز است، این کار در فهرست او می‌آید." },
  { value: "WEEKLY", label: "روزهای مشخصی از هفته", hint: "مثلاً فقط شنبه‌ها و سه‌شنبه‌ها." },
  { value: "MONTHLY", label: "یک روز از هر ماه", hint: "مثلاً روز اول هر ماه. اگر ماهی کوتاه‌تر بود، آخرین روز همان ماه." },
];

export function DutyForm({
  duty,
  users,
}: {
  duty?: DutyFormValues;
  users: { id: string; name: string; roleLabel: string }[];
}) {
  const editing = !!duty;

  return (
    <CrudDialog
      title={editing ? `ویرایش «${duty.title}»` : "تعریف مسئولیت"}
      description="کاری که تکرار می‌شود. هر روز که نوبتش برسد، خودکار در فهرست کارهای آن نفر می‌آید."
      action={saveDuty}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "تعریف مسئولیت"}
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
            تعریف مسئولیت
          </Button>
        )
      }
    >
      {(errors) => <Fields duty={duty} users={users} errors={errors} />}
    </CrudDialog>
  );
}

function Fields({
  duty,
  users,
  errors,
}: {
  duty?: DutyFormValues;
  users: { id: string; name: string; roleLabel: string }[];
  errors: Record<string, string>;
}) {
  const [repeat, setRepeat] = useState<DutyRepeat>(duty?.repeat ?? "DAILY");
  // روزهای هفته در state نگه داشته می‌شوند تا دکمه‌ها دوحالته باشند؛
  // مقدار واقعی با input مخفی ارسال می‌شود
  const [days, setDays] = useState<number[]>(duty?.weekdays ?? []);

  const active = REPEATS.find((r) => r.value === repeat)!;

  return (
    <>
      {duty && <input type="hidden" name="id" value={duty.id} />}

      <Field label="این کار چیست؟" required error={errors.title}>
        <Input name="title" defaultValue={duty?.title} placeholder="آخر وقت صندوق را ببند" />
      </Field>

      <Field
        label="توضیح"
        error={errors.note}
        hint="برای کسی که اولین بار انجامش می‌دهد — کجا، چطور، با چه کسی"
      >
        <Textarea name="note" rows={3} defaultValue={duty?.note ?? ""} />
      </Field>

      <Field label="گردن چه کسی است؟" required error={errors.assigneeId}>
        <Select name="assigneeId" defaultValue={duty?.assigneeId ?? ""}>
          <option value="">انتخاب کنید...</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.roleLabel}
            </option>
          ))}
        </Select>
      </Field>

      {users.length === 0 && (
        <p className="-mt-2 rounded-2xl bg-amber-50/60 p-3.5 text-xs leading-6 text-amber-800 dark:bg-amber-500/5 dark:text-amber-300">
          هنوز هیچ حساب کاربری فعالی نیست. اول از بخش «کاربران» برای پرسنل حساب بسازید.
        </p>
      )}

      <Field label="هر چند وقت؟" required error={errors.repeat}>
        <Select
          name="repeat"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as DutyRepeat)}
        >
          {REPEATS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>

      <p className="-mt-2 rounded-2xl bg-[color:var(--bg-sunken)] p-3.5 text-xs leading-6 text-[color:var(--fg-muted)]">
        {active.hint}
      </p>

      {repeat === "WEEKLY" && (
        <Field label="کدام روزها؟" required error={errors.weekdays}>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS_FA.map((label, index) => {
              const on = days.includes(index);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDays((prev) =>
                      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index],
                    )
                  }
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                    on
                      ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                      : "border-[color:var(--line)] hover:bg-[color:var(--bg-sunken)]",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {days.map((d) => (
            <input key={d} type="hidden" name="weekdays" value={d} />
          ))}
        </Field>
      )}

      {repeat === "MONTHLY" && (
        <Field label="روز چندم هر ماه؟" required error={errors.monthDay} hint="بین ۱ تا ۳۱">
          <Input
            name="monthDay"
            defaultValue={duty?.monthDay ?? ""}
            inputMode="numeric"
            dir="ltr"
            className="text-right"
            placeholder={toFa(1)}
          />
        </Field>
      )}

      <Field
        label="چه وقتِ روز؟"
        error={errors.timeHint}
        hint="اختیاری — فقط به‌عنوان راهنما زیر عنوان کار نوشته می‌شود"
      >
        <Input name="timeHint" defaultValue={duty?.timeHint ?? ""} placeholder="آخر وقت" />
      </Field>

      <Check name="isActive" label="فعال است" defaultChecked={duty?.isActive ?? true} />
    </>
  );
}
