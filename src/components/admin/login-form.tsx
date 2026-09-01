"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";
import { login, type LoginState } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next ?? "/admin"} />

      <Field label="ایمیل" required error={state.errors?.email}>
        <Input
          name="email"
          type="email"
          placeholder="admin@sharzadclinic.ir"
          autoComplete="username"
          dir="ltr"
          className="text-right"
        />
      </Field>

      <Field label="رمز عبور" required error={state.errors?.password}>
        <div className="relative">
          <Input
            name="password"
            type={show ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
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

      {state.message && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
          <TriangleAlert className="size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      <LogIn className="size-4" />
      {pending ? "در حال ورود..." : "ورود به پنل"}
    </Button>
  );
}
