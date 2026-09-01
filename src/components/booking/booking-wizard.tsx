"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Calendar, Check, CircleCheck, Clock, Copy,
  Loader2, Sparkles, User,
} from "lucide-react";
import { toast } from "sonner";
import { createBooking } from "@/app/actions/booking";
import { JalaliCalendar } from "./jalali-calendar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration, formatPriceRange, toFa } from "@/lib/utils";

export type WizardService = {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  durationMinutes: number;
  categoryTitle: string;
};

export type WizardStaff = {
  id: string;
  name: string;
  title: string;
  avatar: string | null;
  serviceIds: string[];
};

type Slot = { time: string; label: string; staffId: string; staffName: string };

const STEPS = ["خدمت", "متخصص", "زمان", "اطلاعات"] as const;

export function BookingWizard({
  services,
  staff,
  initialServiceSlug,
}: {
  services: WizardService[];
  staff: WizardStaff[];
  initialServiceSlug?: string;
}) {
  const initial = services.find((s) => s.slug === initialServiceSlug) ?? null;

  const [step, setStep] = useState(initial ? 1 : 0);
  const [service, setService] = useState<WizardService | null>(initial);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ code: string; summary: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const eligibleStaff = service ? staff.filter((s) => s.serviceIds.includes(service.id)) : [];

  // با تغییر خدمت/متخصص/تاریخ، نوبت‌های خالی را دوباره می‌گیریم
  useEffect(() => {
    if (!service || !dateKey) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setTime(null);

    const params = new URLSearchParams({ serviceId: service.id, date: dateKey });
    if (staffId) params.set("staffId", staffId);

    fetch(`/api/slots?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [service, dateKey, staffId]);

  function submit(formData: FormData) {
    if (!service || !dateKey || !time) return;
    formData.set("serviceId", service.id);
    formData.set("dateKey", dateKey);
    formData.set("time", time);
    const chosen = slots.find((s) => s.time === time);
    if (chosen) formData.set("staffId", chosen.staffId);

    startTransition(async () => {
      const result = await createBooking(formData);
      if (result.ok) {
        setDone({ code: result.code, summary: result.summary });
        setErrors({});
      } else {
        setErrors(result.errors ?? {});
        if (result.message) toast.error(result.message);
      }
    });
  }

  if (done) {
    return <SuccessCard code={done.code} summary={done.summary} />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Stepper current={step} />

      <div className="mt-10 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 shadow-soft sm:p-9">
        {/* گام ۱ — انتخاب خدمت */}
        {step === 0 && (
          <StepShell title="کدام خدمت را می‌خواهید؟" hint="می‌توانید بعداً در کلینیک تغییرش دهید.">
            <div className="grid max-h-[28rem] gap-3 overflow-y-auto pl-1 sm:grid-cols-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setService(s);
                    setStaffId(null);
                    setDateKey(null);
                    setStep(1);
                  }}
                  className={cn(
                    "flex items-center gap-4 rounded-3xl border p-4 text-right transition-all",
                    service?.id === s.id
                      ? "border-rose-500 bg-rose-50/60 dark:bg-rose-500/10"
                      : "border-[color:var(--line)] hover:border-rose-300 hover:bg-[color:var(--bg-sunken)]"
                  )}
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--bg-sunken)]">
                    {s.image && <Image src={s.image} alt="" fill sizes="56px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.title}</span>
                    <span className="mt-0.5 block text-xs text-[color:var(--fg-muted)]">
                      {formatDuration(s.durationMinutes)} • {formatPriceRange(s.priceFrom, s.priceTo)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {/* گام ۲ — انتخاب متخصص */}
        {step === 1 && service && (
          <StepShell
            title="متخصص را انتخاب کنید"
            hint="اگر ترجیحی ندارید، «فرقی نمی‌کند» را بزنید تا اولین وقت خالی به شما پیشنهاد شود."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setStaffId(null);
                  setStep(2);
                }}
                className={cn(
                  "flex items-center gap-4 rounded-3xl border p-4 text-right transition-all",
                  staffId === null
                    ? "border-rose-500 bg-rose-50/60 dark:bg-rose-500/10"
                    : "border-[color:var(--line)] hover:border-rose-300"
                )}
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white">
                  <Sparkles className="size-6" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">فرقی نمی‌کند</span>
                  <span className="mt-0.5 block text-xs text-[color:var(--fg-muted)]">
                    زودترین وقت خالی
                  </span>
                </span>
              </button>

              {eligibleStaff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setStaffId(member.id);
                    setStep(2);
                  }}
                  className={cn(
                    "flex items-center gap-4 rounded-3xl border p-4 text-right transition-all",
                    staffId === member.id
                      ? "border-rose-500 bg-rose-50/60 dark:bg-rose-500/10"
                      : "border-[color:var(--line)] hover:border-rose-300"
                  )}
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--bg-sunken)]">
                    {member.avatar && (
                      <Image src={member.avatar} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{member.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-[color:var(--fg-muted)]">
                      {member.title}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {eligibleStaff.length === 0 && (
              <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                برای این خدمت فعلاً متخصصی در سیستم ثبت نشده. لطفاً تلفنی هماهنگ کنید.
              </p>
            )}
          </StepShell>
        )}

        {/* گام ۳ — تاریخ و ساعت */}
        {step === 2 && service && (
          <StepShell title="چه روز و ساعتی؟" hint="ابتدا روز را انتخاب کنید تا ساعت‌های خالی نمایش داده شود.">
            <div className="grid gap-6 lg:grid-cols-2">
              <JalaliCalendar value={dateKey} onChange={setDateKey} />

              <div className="rounded-4xl border border-[color:var(--line)] p-5 sm:p-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <Clock className="size-4 text-rose-500" />
                  ساعت‌های خالی
                </h3>

                {!dateKey && (
                  <EmptyHint icon={Calendar} text="ابتدا یک روز را از تقویم انتخاب کنید." />
                )}

                {dateKey && loadingSlots && (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="skeleton h-11 rounded-2xl" />
                    ))}
                  </div>
                )}

                {dateKey && !loadingSlots && slots.length === 0 && (
                  <EmptyHint icon={Clock} text="متأسفانه این روز وقت خالی ندارد. روز دیگری را امتحان کنید." />
                )}

                {dateKey && !loadingSlots && slots.length > 0 && (
                  <>
                    <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pl-1">
                      {slots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setTime(slot.time)}
                          className={cn(
                            "h-11 rounded-2xl border text-sm font-medium tabular-nums transition-all",
                            time === slot.time
                              ? "border-rose-500 bg-rose-500 text-white"
                              : "border-[color:var(--line)] hover:border-rose-300 hover:text-rose-600"
                          )}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                    {time && (
                      <p className="mt-4 rounded-2xl bg-[color:var(--bg-sunken)] p-3 text-center text-xs text-[color:var(--fg-muted)]">
                        متخصص: {slots.find((s) => s.time === time)?.staffName}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </StepShell>
        )}

        {/* گام ۴ — اطلاعات تماس */}
        {step === 3 && service && dateKey && time && (
          <StepShell title="اطلاعات تماس شما" hint="برای تأیید نهایی با همین شماره تماس می‌گیریم.">
            <Summary
              service={service}
              time={time}
              staffName={slots.find((s) => s.time === time)?.staffName}
            />

            <form action={submit} className="mt-7 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="نام" required error={errors.firstName}>
                  <Input name="firstName" placeholder="مریم" autoComplete="given-name" />
                </Field>
                <Field label="نام خانوادگی" required error={errors.lastName}>
                  <Input name="lastName" placeholder="رضایی" autoComplete="family-name" />
                </Field>
              </div>

              <Field label="شماره موبایل" required error={errors.phone} hint="کد پیگیری به همین شماره مربوط می‌شود">
                <Input
                  name="phone"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  className="text-right"
                />
              </Field>

              <Field label="توضیحات" error={errors.note} hint="اختیاری — هر نکته‌ای که لازم است بدانیم">
                <Textarea name="note" rows={3} placeholder="مثلاً سابقه‌ی حساسیت، دارو یا سؤال خاص..." />
              </Field>

              <Button type="submit" size="lg" disabled={pending} className="w-full">
                {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                {pending ? "در حال ثبت..." : "ثبت نهایی نوبت"}
              </Button>

              <p className="text-center text-xs leading-6 text-[color:var(--fg-muted)]">
                با ثبت نوبت، با تماس همکاران ما برای تأیید موافقت می‌کنید.
                <br />
                لغو یا جابه‌جایی تا ۶ ساعت قبل امکان‌پذیر است.
              </p>
            </form>
          </StepShell>
        )}

        {/* ناوبری */}
        <div className="mt-9 flex items-center justify-between border-t border-[color:var(--line)] pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowRight className="size-4" />
            مرحله قبل
          </Button>

          {step < 3 && (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 0 && !service) ||
                (step === 1 && eligibleStaff.length === 0) ||
                (step === 2 && (!dateKey || !time))
              }
            >
              مرحله بعد
              <ArrowLeft className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-between gap-1 sm:gap-2">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        return (
          <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold transition-all sm:size-11 sm:text-sm",
                  state === "done" && "bg-rose-500 text-white",
                  state === "active" &&
                    "bg-rose-500 text-white shadow-[0_0_0_5px_rgba(183,110,121,0.18)]",
                  state === "todo" && "border border-[color:var(--line)] text-[color:var(--fg-muted)]"
                )}
              >
                {state === "done" ? <Check className="size-4" /> : toFa(i + 1)}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium sm:text-xs",
                  state === "todo" ? "text-[color:var(--fg-muted)]" : "text-[color:var(--fg)]"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "mb-6 h-0.5 flex-1 rounded-full transition-colors",
                  i < current ? "bg-rose-500" : "bg-[color:var(--line)]"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
      {hint && <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">{hint}</p>}
      <div className="mt-7">{children}</div>
    </div>
  );
}

function EmptyHint({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[color:var(--line)] p-8 text-center">
      <Icon className="mx-auto size-8 text-rose-300" />
      <p className="mt-3 text-sm leading-7 text-[color:var(--fg-muted)]">{text}</p>
    </div>
  );
}

function Summary({
  service,
  time,
  staffName,
}: {
  service: WizardService;
  time: string;
  staffName?: string;
}) {
  return (
    <div className="grid gap-3 rounded-3xl bg-[color:var(--bg-sunken)] p-5 sm:grid-cols-3">
      <SummaryRow icon={Sparkles} label="خدمت" value={service.title} />
      <SummaryRow icon={Clock} label="ساعت" value={toFa(time)} />
      <SummaryRow icon={User} label="متخصص" value={staffName ?? "تعیین‌نشده"} />
    </div>
  );
}

function SummaryRow({
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
      <div className="min-w-0">
        <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function SuccessCard({ code, summary }: { code: string; summary: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-10 text-center shadow-lift">
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CircleCheck className="size-11" />
      </div>

      <h2 className="mt-7 text-2xl font-extrabold">نوبت شما ثبت شد 🎉</h2>
      <p className="mt-3 text-sm leading-8 text-[color:var(--fg-muted)]">
        {summary}
        <br />
        همکاران ما به‌زودی برای تأیید نهایی با شما تماس می‌گیرند.
      </p>

      <div className="mt-8 rounded-3xl border border-dashed border-rose-300 bg-rose-50/50 p-6 dark:border-rose-300/25 dark:bg-rose-500/5">
        <p className="text-xs text-[color:var(--fg-muted)]">کد پیگیری شما</p>
        <p className="mt-2 select-all text-2xl font-extrabold tracking-widest text-rose-600 dark:text-rose-300">
          {code}
        </p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(
              () => toast.success("کد پیگیری کپی شد"),
              () => toast.error("کپی نشد — دستی یادداشت کنید")
            );
          }}
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline dark:text-rose-300"
        >
          <Copy className="size-3.5" />
          کپی کد
        </button>
      </div>

      <Badge tone="amber" className="mt-6">
        این کد را یادداشت کنید — برای پیگیری لازم است
      </Badge>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/track" variant="outline" className="flex-1">
          پیگیری نوبت
        </ButtonLink>
        <ButtonLink href="/" className="flex-1">
          بازگشت به صفحه‌ی اصلی
        </ButtonLink>
      </div>

      <p className="mt-6 text-xs text-[color:var(--fg-muted)]">
        نیاز به تغییر دارید؟{" "}
        <Link href="/contact" className="text-rose-600 hover:underline dark:text-rose-300">
          با ما تماس بگیرید
        </Link>
      </p>
    </div>
  );
}
