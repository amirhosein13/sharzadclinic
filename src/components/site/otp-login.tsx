"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, KeyRound, Loader2, Smartphone, TriangleAlert } from "lucide-react";
import { confirmOtp, requestOtp, type OtpState } from "@/app/actions/customer";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/utils";

const INITIAL: OtpState = { step: "phone" };

export function OtpLogin() {
  const [state, action] = useActionState<OtpState, FormData>(
    async (prev, formData) =>
      formData.get("code") !== null ? confirmOtp(prev, formData) : requestOtp(prev, formData),
    INITIAL
  );

  return state.step === "phone" ? (
    <PhoneStep action={action} message={state.message} />
  ) : (
    <CodeStep action={action} state={state} />
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
