"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { submitContact, type ContactState } from "@/app/actions/contact";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const INITIAL: ContactState = { ok: false };

export function ContactForm() {
  const [state, action] = useActionState(submitContact, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    } else if (!state.ok && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="نام و نام خانوادگی" required error={state.errors?.name}>
          <Input name="name" placeholder="مثلاً مریم رضایی" autoComplete="name" />
        </Field>
        <Field label="شماره موبایل" required error={state.errors?.phone}>
          <Input name="phone" placeholder="۰۹۱۲۳۴۵۶۷۸۹" inputMode="tel" autoComplete="tel" dir="ltr" className="text-right" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="ایمیل" error={state.errors?.email} hint="اختیاری">
          <Input name="email" type="email" placeholder="you@example.com" dir="ltr" className="text-right" />
        </Field>
        <Field label="موضوع" error={state.errors?.subject} hint="اختیاری">
          <Input name="subject" placeholder="مثلاً سؤال درباره‌ی لیزر" />
        </Field>
      </div>

      <Field label="متن پیام" required error={state.errors?.body}>
        <Textarea name="body" rows={5} placeholder="سؤال یا درخواستتان را بنویسید..." />
      </Field>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      <Send className="size-4" />
      {pending ? "در حال ارسال..." : "ارسال پیام"}
    </Button>
  );
}
