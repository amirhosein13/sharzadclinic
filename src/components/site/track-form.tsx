"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarClock, Search, Sparkles, TriangleAlert, User } from "lucide-react";
import { trackAppointment, type TrackResult } from "@/app/actions/booking";
import { Field, Input } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, { label: string; tone: "amber" | "green" | "red" | "neutral" }> = {
  PENDING: { label: "در انتظار تأیید", tone: "amber" },
  CONFIRMED: { label: "تأیید شده", tone: "green" },
  DONE: { label: "انجام شده", tone: "neutral" },
  CANCELLED: { label: "لغو شده", tone: "red" },
  NO_SHOW: { label: "عدم مراجعه", tone: "red" },
};

export function TrackForm() {
  const [state, action] = useActionState<TrackResult | null, FormData>(trackAppointment, null);

  return (
    <div className="mx-auto max-w-xl">
      <form
        action={action}
        className="space-y-5 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-8 shadow-soft"
      >
        <Field label="کد پیگیری" required>
          <Input name="code" placeholder="SH-XXXXX" dir="ltr" className="text-right uppercase tracking-widest" />
        </Field>
        <Field label="شماره موبایل" required>
          <Input name="phone" placeholder="۰۹۱۲۳۴۵۶۷۸۹" inputMode="tel" dir="ltr" className="text-right" />
        </Field>
        <SubmitButton />
      </form>

      {state && !state.ok && (
        <div className="mt-6 flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <p className="leading-7">{state.message}</p>
        </div>
      )}

      {state?.ok && (
        <div className="mt-6 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-8 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-[color:var(--fg-muted)]">
              کد پیگیری:{" "}
              <span className="font-bold tracking-widest text-[color:var(--fg)]">
                {state.appointment.code}
              </span>
            </p>
            <Badge tone={STATUS_LABELS[state.appointment.status]?.tone ?? "neutral"}>
              {STATUS_LABELS[state.appointment.status]?.label ?? state.appointment.status}
            </Badge>
          </div>

          <dl className="mt-6 space-y-4 border-t border-[color:var(--line)] pt-6">
            <Row icon={User} label="نام" value={state.appointment.customerName} />
            <Row icon={Sparkles} label="خدمت" value={state.appointment.serviceTitle} />
            <Row icon={CalendarClock} label="زمان نوبت" value={state.appointment.when} />
            {state.appointment.staffName && (
              <Row icon={User} label="متخصص" value={state.appointment.staffName} />
            )}
          </dl>

          <p className="mt-6 rounded-2xl bg-[color:var(--bg-sunken)] p-4 text-xs leading-7 text-[color:var(--fg-muted)]">
            برای لغو یا جابه‌جایی نوبت، تا ۶ ساعت قبل با کلینیک تماس بگیرید.
          </p>

          <ButtonLink href="/booking" variant="outline" className="mt-5 w-full">
            رزرو نوبت جدید
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-4 shrink-0 text-rose-500" />
      <dt className="w-20 shrink-0 text-xs text-[color:var(--fg-muted)]">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      <Search className="size-4" />
      {pending ? "در حال جستجو..." : "مشاهده‌ی وضعیت نوبت"}
    </Button>
  );
}
