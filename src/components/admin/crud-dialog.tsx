"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "@/components/ui/button";
import type { FormResult } from "@/app/actions/content";

/**
 * دیالوگ ساخت/ویرایش. فیلدها را به‌صورت children می‌گیرد و ارسال،
 * نمایش پیام و بستن خودکار را خودش مدیریت می‌کند.
 *
 * `children` یک تابع است تا با هر بار بازشدن، فیلدها از نو ساخته
 * شوند و مقدار پیش‌فرض قبلی باقی نماند.
 */
export function CrudDialog({
  trigger,
  title,
  description,
  action,
  children,
  submitLabel = "ذخیره",
  wide,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description?: string;
  action: (formData: FormData) => Promise<FormResult>;
  children: (errors: Record<string, string>) => React.ReactNode;
  submitLabel?: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setErrors({});
  }

  return (
    <>
      {trigger(() => setOpen(true))}

      <Modal open={open} onClose={close} title={title} description={description} wide={wide}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await action(formData);
              if (result.ok) {
                toast.success(result.message);
                close();
              } else {
                setErrors(result.errors ?? {});
                toast.error(result.message);
              }
            })
          }
          className="space-y-5"
        >
          {children(errors)}

          <div className="flex gap-3 border-t border-[color:var(--line)] pt-5">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {pending ? "در حال ذخیره..." : submitLabel}
            </Button>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              انصراف
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** چک‌باکس با ظاهر یکدست در فرم‌ها */
export function Check({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--line)] p-3.5 transition-colors hover:bg-[color:var(--bg-sunken)]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-rose-500"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-[color:var(--fg-muted)]">{hint}</span>}
      </span>
    </label>
  );
}

/** انتخاب چندتایی با چک‌باکس — برای اتصال خدمات به پرسنل و برعکس */
export function MultiCheck({
  name,
  label,
  options,
  selected,
  emptyHint,
}: {
  name: string;
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  emptyHint?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {options.length === 0 ? (
        <p className="rounded-2xl bg-[color:var(--bg-sunken)] p-4 text-xs text-[color:var(--fg-muted)]">
          {emptyHint ?? "موردی برای انتخاب وجود ندارد."}
        </p>
      ) : (
        <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-2xl border border-[color:var(--line)] p-3">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-[color:var(--bg-sunken)]"
            >
              <input
                type="checkbox"
                name={name}
                value={option.id}
                defaultChecked={selected.includes(option.id)}
                className="size-4 shrink-0 accent-rose-500"
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
