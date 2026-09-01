import Image from "next/image";
import { CalendarHeart, Play, ShieldCheck, Sparkles, Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { toFa } from "@/lib/utils";

export function Hero({ tagline, clinicName }: { tagline: string; clinicName: string }) {
  return (
    <section className="grain relative overflow-hidden">
      {/* پس‌زمینه‌ی گرادیانی و حباب‌های نرم */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-bl from-rose-50 via-cream-50 to-cream-100 dark:from-plum-800 dark:via-plum-900 dark:to-plum-900" />
        <div className="animate-[float_9s_ease-in-out_infinite] absolute -right-24 -top-20 size-[30rem] rounded-full bg-rose-200/45 blur-3xl dark:bg-rose-500/10" />
        <div className="animate-[float_11s_ease-in-out_infinite_reverse] absolute -bottom-32 -left-20 size-[26rem] rounded-full bg-gold-300/35 blur-3xl dark:bg-gold-500/8" />
      </div>

      <div className="container-page grid items-center gap-14 py-20 lg:grid-cols-2 lg:py-28">
        <div className="text-center lg:text-right">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-white/70 px-4 py-2 text-xs font-medium text-gold-600 shadow-soft backdrop-blur dark:bg-white/5 dark:text-gold-300">
            <Sparkles className="size-3.5" />
            بیش از {toFa(15)} سال تجربه در خدمت زیبایی شما
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.25] sm:text-5xl lg:text-[3.4rem]">
            <span className="block">{tagline.split("،")[0]}،</span>
            <span className="text-gradient block">{tagline.split("،").slice(1).join("،").trim()}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-[color:var(--fg-muted)] lg:mx-0">
            در {clinicName} با جدیدترین دستگاه‌های روز دنیا، متریال اورجینال و کادری کاملاً متخصص،
            نتیجه‌ای می‌گیرید که طبیعی به‌نظر می‌رسد — نه اغراق‌شده.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <ButtonLink href="/booking" size="lg" className="w-full sm:w-auto">
              <CalendarHeart className="size-5" />
              رزرو نوبت آنلاین
            </ButtonLink>
            <ButtonLink href="/services" variant="outline" size="lg" className="w-full sm:w-auto">
              <Play className="size-4" />
              مشاهده‌ی خدمات
            </ButtonLink>
          </div>

          {/* اعتمادسازی */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4 text-sm text-[color:var(--fg-muted)] lg:justify-start">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-[18px] text-rose-500" />
              متریال دارای کد رهگیری
            </span>
            <span className="flex items-center gap-2">
              <Star className="size-[18px] fill-gold-400 text-gold-400" />
              <strong className="font-semibold text-[color:var(--fg)]">{toFa("4.9")}</strong>
              از {toFa(680)} نظر
            </span>
          </div>
        </div>

        {/* تصویر */}
        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="relative aspect-4/5 overflow-hidden rounded-[2.5rem] shadow-lift ring-1 ring-white/50 dark:ring-white/10">
            <Image
              src="/images/hero.svg"
              alt={`محیط ${clinicName}`}
              fill
              priority
              sizes="(max-width: 1024px) 90vw, 45vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-plum-600/25 to-transparent" />
          </div>

          {/* کارت شناور آمار */}
          <div className="absolute -bottom-6 right-4 flex items-center gap-4 rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-6 py-4 shadow-lift sm:right-8">
            <div className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
              <Sparkles className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight">{toFa("۱۲٬۰۰۰+")}</p>
              <p className="text-xs text-[color:var(--fg-muted)]">مراجعه‌ی موفق</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
