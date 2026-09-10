"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, KeyRound, Loader2, Smartphone, TriangleAlert, UserRound } from "lucide-react";
import {
  chooseCustomerFile, confirmOtp, requestOtp, type OtpState,
} from "@/app/actions/customer";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/utils";

const INITIAL: OtpState = { step: "phone" };

export function OtpLogin() {
  const [state, action] = useActionState<OtpState, FormData>(async (prev, formData) => {
    if (formData.get("customerId") !== null) return chooseCustomerFile(prev, formData);
    if (formData.get("code") !== null) return confirmOtp(prev, formData);
    return requestOtp(prev, formData);
  }, INITIAL);

  if (state.step === "phone") return <PhoneStep action={action} message={state.message} />;
  if (state.step === "choose") return <ChooseStep action={action} state={state} />;
  return <CodeStep action={action} state={state} />;
}

/**
 * وقتی چند پرونده روی یک شماره ثبت است (مثلاً مادر و دختر)، بعد از تأیید کد
 * از خودِ فرد می‌پرسیم کدام پرونده مال اوست.
 */
function ChooseStep({
  action,
  state,
}: {
  action: (formData: FormData) => void;
  state: Extract<OtpState, { step: "choose" }>;
}) {
  return (
    <div className="space-y-5">
      <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
        <UserRound className="size-7" />
      </div>

      <div className="text-center">
        <h1 className="text-xl font-bold">کدام پرونده مال شماست؟</h1>
        <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">
          روی شماره‌ی <span dir="ltr">{toFa(state.phone)}</span> بیش از یک پرونده ثبت شده است.
        </p>
      </div>

      {state.message && <ErrorNote>{state.message}</ErrorNote>}

      <div className="space-y-2.5">
        {state.choices.map((choice) => (
          <form key={choice.id} action={action}>
            <button
              type="submit"
              name="customerId"
              value={choice.id}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] p-4 text-right transition-colors hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{choice.name}</span>
                {choice.hint && (
                  <span className="block text-xs text-[color:var(--fg-muted)]">{choice.hint}</span>
                )}
              </span>
              <ArrowRight className="size-4 shrink-0 text-rose-400" />
            </button>
          </form>
        ))}
      </div>

      <p className="text-center text-xs leading-6 text-[color:var(--fg-muted)]">
        اگر پرونده‌ی شما اینجا نیست یا شماره‌ی خودتان را دارید، به کلینیک بگویید تا
        شماره‌ی پرونده‌تان را جدا کند.
      </p>
    </div>
  );
}

function PhoneStep({
  action,
  message,
}: {
  action: (formData: FormData) => void;
  message?: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
        <Smartphone className="size-7" />
      </div>

      <div className="text-center">
        <h1 className="text-xl font-bold">ورود به حساب</h1>
        <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">
          شماره موبایلی که با آن نوبت گرفته‌اید را وارد کنید تا کد ورود برایتان ارسال شود.
        </p>
      </div>

      <Field label="شماره موبایل" required>
        <Input
          name="phone"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          dir="ltr"
          className="text-center text-lg tracking-widest"
        />
      </Field>

      {message && <ErrorNote>{message}</ErrorNote>}

      <SubmitButton label="ارسال کد ورود" pendingLabel="در حال ارسال..." />
    </form>
  );
}

function CodeStep({
  action,
  state,
}: {
  action: (formData: FormData) => void;
  state: Extract<OtpState, { step: "code" }>;
}) {
  const [seconds, setSeconds] = useState(180);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <input type="hidden" name="phone" value={state.phone} />

      <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
        <KeyRound className="size-7" />
      </div>

      <div className="text-center">
        <h1 className="text-xl font-bold">کد ورود را وارد کنید</h1>
        <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">
          کد ۶ رقمی به شماره‌ی <span dir="ltr">{toFa(state.phone)}</span> پیامک شد.
        </p>
      </div>

      {state.devCode && (
        <p className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3.5 text-center text-sm dark:border-amber-400/25 dark:bg-amber-500/10">
          حالت توسعه — کد شما:{" "}
          <strong className="tracking-widest" dir="ltr">
            {toFa(state.devCode)}
          </strong>
        </p>
      )}

      <Field label="کد ۶ رقمی" required>
        <Input
          name="code"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          autoComplete="one-time-code"
          placeholder="------"
          dir="ltr"
          className="text-center text-2xl tracking-[0.6em]"
        />
      </Field>

      {state.message && <ErrorNote>{state.message}</ErrorNote>}

      <SubmitButton label="ورود" pendingLabel="در حال بررسی..." />

      <div className="flex items-center justify-between text-xs">
        <button
          type="submit"
          name="phone"
          value={state.phone}
          formNoValidate
          onClick={() => {
            const code = formRef.current?.elements.namedItem("code") as HTMLInputElement | null;
            if (code) code.remove();
            setSeconds(180);
          }}
          disabled={seconds > 0}
          className="text-rose-600 transition-colors hover:underline disabled:text-[color:var(--fg-muted)] disabled:no-underline dark:text-rose-300"
        >
          {seconds > 0 ? `ارسال دوباره تا ${toFa(seconds)} ثانیه` : "ارسال دوباره‌ی کد"}
        </button>

        <a href="/login" className="flex items-center gap-1 text-[color:var(--fg-muted)] hover:text-rose-500">
          تغییر شماره
          <ArrowRight className="size-3.5" />
        </a>
      </div>
    </form>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-red-50 p-3.5 text-sm leading-6 text-red-700 dark:bg-red-500/10 dark:text-red-200">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}
