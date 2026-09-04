"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Eye, EyeOff, KeyRound, Send, TriangleAlert } from "lucide-react";
import { requestReset, submitReset, type ResetState } from "@/app/actions/password-reset";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/utils";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? null : <Send className="size-4" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-red-50 p-3.5 text-sm leading-7 text-red-700 dark:bg-red-500/10 dark:text-red-200">
      <TriangleAlert className="mt-1 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * بازیابی رمز پنل در دو مرحله: ایمیل ← کد پیامکی + رمز تازه.
 * کد به موبایلی می‌رود که برای همان کاربر در بخش «کاربران» ثبت شده است.
 */
export function ForgotForm() {
  const [state, action] = useActionState<ResetState, FormData>(requestReset, { step: "email" });

  if (state.step === "code") return <CodeStep initial={state} />;
  if (state.step === "done") return <Done />;

  return (
    <form action={action} className="space-y-5">
      <Field label="ایمیل حساب پنل" required error={state.errors?.email}>
        <Input
          name="email"
          type="email"
          placeholder="admin@sharzadclinic.ir"
          autoComplete="username"
          dir="ltr"
          className="text-right"
          autoFocus
        />
      </Field>

      <p className="text-xs leading-6 text-[color:var(--fg-muted)]">
        کد بازیابی به موبایلی پیامک می‌شود که برای همین حساب در بخش «کاربران» ثبت شده است.
        اگر موبایلی ثبت نشده، مدیر باید از روی سرور با دستور{" "}
        <code dir="ltr">npm run reset-password</code> رمز را عوض کند.
      </p>

      {state.message && <Alert>{state.message}</Alert>}

      <SubmitButton label="فرستادن کد" pendingLabel="در حال فرستادن..." />

      <Link
        href="/admin/login"
        className="block text-center text-xs text-[color:var(--fg-muted)] transition-colors hover:text-rose-500"
      >
        بازگشت به ورود
      </Link>
    </form>
  );
}

function CodeStep({ initial }: { initial: Extract<ResetState, { step: "code" }> }) {
  const [state, action] = useActionState<ResetState, FormData>(submitReset, initial);
  const [show, setShow] = useState(false);

  if (state.step === "done") return <Done />;

  const view = state.step === "code" ? state : initial;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="email" value={view.email} />

      <p className="rounded-2xl bg-[color:var(--bg-sunken)] p-3.5 text-xs leading-7">
        {view.hint}
      </p>

      {initial.devCode && (
        <p className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3.5 text-center text-sm dark:border-amber-400/30 dark:bg-amber-500/10">
          کد آزمایشی (فقط در حالت توسعه):{" "}
          <b className="text-lg tracking-widest">{toFa(initial.devCode)}</b>
        </p>
      )}

      <Field label="کد ۶ رقمی" required error={state.step === "code" ? state.errors?.code : undefined}>
        <Input
          name="code"
          inputMode="numeric"
          maxLength={6}
          placeholder="۱۲۳۴۵۶"
          dir="ltr"
          className="text-center text-lg tracking-[0.4em]"
          autoFocus
        />
      </Field>

      <Field
        label="رمز عبور تازه"
        required
        hint="حداقل ۸ کاراکتر"
        error={state.step === "code" ? state.errors?.password : undefined}
      >
        <div className="relative">
          <Input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            dir="ltr"
            className="pl-12 text-right"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "پنهان‌کردن رمز" : "نمایش رمز"}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-muted)] transition-colors hover:text-rose-500"
          >
            {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </Field>

      {state.step === "code" && state.message && <Alert>{state.message}</Alert>}

      <SubmitButton label="ثبت رمز تازه" pendingLabel="در حال ثبت..." />

      <Link
        href="/admin/forgot"
        className="block text-center text-xs text-[color:var(--fg-muted)] transition-colors hover:text-rose-500"
      >
        کد نرسید؟ از اول شروع کنید
      </Link>
    </form>
  );
}

function Done() {
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CheckCircle2 className="size-7" />
      </span>
      <div>
        <p className="font-bold">رمز عبور عوض شد</p>
        <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">
          حالا می‌توانید با رمز تازه وارد شوید.
        </p>
      </div>
      <Link href="/admin/login" className="block">
        <Button size="lg" className="w-full">
          <KeyRound className="size-4" />
          ورود به پنل
        </Button>
      </Link>
    </div>
  );
}
