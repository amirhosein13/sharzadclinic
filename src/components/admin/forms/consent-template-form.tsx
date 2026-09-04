"use client";

import { FilePlus2, Pencil } from "lucide-react";
import { CrudDialog, MultiCheck } from "@/components/admin/crud-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveConsentTemplate } from "@/app/actions/consents";

export type ConsentTemplateValues = {
  id: string;
  title: string;
  slug: string;
  body: string;
  order: number;
  isActive: boolean;
  serviceIds: string[];
};

export type ConsentServiceOption = { id: string; title: string };

const PLACEHOLDERS = [
  { key: "{{نام}}", label: "نام مراجعه‌کننده" },
  { key: "{{کدملی}}", label: "کد ملی" },
  { key: "{{تاریخ}}", label: "تاریخ امضا" },
  { key: "{{کلینیک}}", label: "نام کلینیک" },
];

export function ConsentTemplateForm({
  template,
  services,
}: {
  template?: ConsentTemplateValues;
  services: ConsentServiceOption[];
}) {
  const editing = !!template;

  return (
    <CrudDialog
      title={editing ? `ویرایش «${template.title}»` : "رضایت‌نامه‌ی جدید"}
      description="متنی که پیش از درمان به مراجعه‌کننده نشان داده و امضا می‌شود."
      action={saveConsentTemplate}
      submitLabel={editing ? "ذخیره‌ی تغییرات" : "ساخت رضایت‌نامه"}
      wide
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            aria-label="ویرایش رضایت‌نامه"
            className="grid size-9 place-items-center rounded-lg border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            <Pencil className="size-4" />
          </button>
        ) : (
          <Button onClick={open}>
            <FilePlus2 className="size-4" />
            رضایت‌نامه‌ی جدید
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          {editing && <input type="hidden" name="id" value={template.id} />}

          <Field label="عنوان" required error={errors.title} hint="مثل «رضایت‌نامه‌ی لیزر موهای زائد»">
            <Input name="title" defaultValue={template?.title ?? ""} autoFocus />
          </Field>

          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-4">
            <p className="mb-2 text-xs font-medium">در متن می‌توانید از این نشانه‌ها استفاده کنید:</p>
            <ul className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map((p) => (
                <li
                  key={p.key}
                  className="rounded-lg bg-[color:var(--bg-elevated)] px-2.5 py-1 text-[11px] text-[color:var(--fg-muted)]"
                >
                  <code dir="ltr">{p.key}</code> — {p.label}
                </li>
              ))}
            </ul>
          </div>

          <Field label="متن رضایت‌نامه" required error={errors.body}>
            <Textarea name="body" rows={14} defaultValue={template?.body ?? ""} className="leading-8" />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="ترتیب نمایش" error={errors.order} hint="عدد کوچک‌تر بالاتر می‌آید">
              <Input
                name="order"
                defaultValue={template?.order ?? 0}
                inputMode="numeric"
                dir="ltr"
                className="text-right"
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-2xl border border-[color:var(--line)] p-4 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={template?.isActive ?? true}
                className="size-4 accent-rose-500"
              />
              فعال — در فهرست امضا نشان داده شود
            </label>
          </div>

          <MultiCheck
            name="serviceIds"
            label="مربوط به کدام خدمات است؟"
            options={services.map((s) => ({ id: s.id, label: s.title }))}
            selected={template?.serviceIds ?? []}
            emptyHint="اول از بخش خدمات، خدمات کلینیک را ثبت کنید."
          />
          <p className="-mt-2 text-xs leading-6 text-[color:var(--fg-muted)]">
            اگر هیچ خدمتی را انتخاب نکنید، این رضایت‌نامه <b>عمومی</b> است و برای همه پیشنهاد می‌شود.
            اگر خدمتی را انتخاب کنید، برای مشتریِ آن خدمت پیشنهاد می‌شود و اگر امضا نشده باشد در
            پرونده‌اش هشدار داده می‌شود.
          </p>
        </>
      )}
    </CrudDialog>
  );
}
