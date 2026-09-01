import type { Metadata } from "next";
import Image from "next/image";
import { Award, BadgeCheck, HeartPulse, ShieldCheck, Sparkles, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { toFa } from "@/lib/utils";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "درباره‌ی ما",
  description: "با تیم، فلسفه‌ی کاری و استانداردهای کلینیک زیبایی شهرزاد آشنا شوید.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: "صداقت پیش از فروش",
    body: "اگر درمانی برای شما مناسب نباشد، همان اول می‌گوییم — حتی اگر به ضرر ما باشد.",
  },
  {
    icon: BadgeCheck,
    title: "شفافیت کامل قیمت",
    body: "بازه‌ی قیمت هر خدمت روی سایت نوشته شده و هزینه‌ی پنهانی وجود ندارد.",
  },
  {
    icon: HeartPulse,
    title: "ایمنی بیمار، خط قرمز",
    body: "استریلیزاسیون با اتوکلاو، متریال دارای مجوز و رعایت کامل پروتکل‌های بهداشتی.",
  },
  {
    icon: Sparkles,
    title: "نتیجه‌ی طبیعی",
    body: "هدف ما این است که کسی نفهمد کاری انجام داده‌اید؛ فقط بگویند سرحال به‌نظر می‌رسید.",
  },
];

export default async function AboutPage() {
  const settings = await getSettings();
  const staff = await prisma.staff.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });

  return (
    <>
      <PageHero
        eyebrow="درباره‌ی ما"
        title={settings.clinicName}
        description={settings.tagline}
        breadcrumbs={[{ href: "/about", label: "درباره‌ی ما" }]}
      />

      {/* داستان */}
      <Section>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="relative order-2 lg:order-1">
            <div className="relative aspect-4/3 overflow-hidden rounded-[2.5rem] shadow-lift">
              <Image
                src="/images/clinic-1.svg"
                alt="محیط کلینیک"
                fill
                sizes="(max-width:1024px) 90vw, 45vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-4 hidden aspect-square w-40 overflow-hidden rounded-3xl border-4 border-[color:var(--bg)] shadow-lift sm:block">
              <Image src="/images/clinic-2.svg" alt="اتاق درمان" fill sizes="160px" className="object-cover" />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <SectionHeading
              align="start"
              eyebrow={`از سال ${toFa(settings.establishedYear)}`}
              title="داستان ما از یک اتاق کوچک شروع شد"
            />
            <div className="mt-8 space-y-5 text-[15px] leading-9 text-[color:var(--fg-muted)]">
              <p>
                کلینیک شهرزاد را با یک باور ساده شروع کردیم: مردم حق دارند بدانند دقیقاً چه کاری
                روی آن‌ها انجام می‌شود، با چه موادی، و چه نتیجه‌ای واقعاً قابل انتظار است.
              </p>
              <p>
                سال‌های اول فقط یک اتاق درمان و یک دستگاه لیزر داشتیم. چیزی که ما را رساند به
                جایی که امروز هستیم، تبلیغات نبود — مراجعینی بودند که خودشان دوستانشان را آوردند.
              </p>
              <p>
                امروز با تیمی از متخصصان پوست و مو، کارشناسان مجرب و دستگاه‌های نسل جدید،
                همان اصل اول را حفظ کرده‌ایم: اول تشخیص درست، بعد درمان.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { icon: Users, value: "۱۲٬۰۰۰+", label: "مراجع" },
                { icon: Award, value: `${toFa(15)}+`, label: "سال تجربه" },
                { icon: Sparkles, value: `${toFa(20)}+`, label: "خدمت" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5 text-center"
                >
                  <s.icon className="mx-auto size-5 text-rose-500" />
                  <p className="mt-3 text-lg font-extrabold">{s.value}</p>
                  <p className="text-[11px] text-[color:var(--fg-muted)]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ارزش‌ها */}
      <Section className="bg-[color:var(--bg-sunken)]">
        <SectionHeading
          eyebrow="اصول ما"
          title="چهار چیزی که هیچ‌وقت روی آن‌ها مصالحه نمی‌کنیم"
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft"
            >
              <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white">
                <v.icon className="size-6" />
              </div>
              <h3 className="font-bold">{v.title}</h3>
              <p className="mt-2.5 text-sm leading-7 text-[color:var(--fg-muted)]">{v.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* تیم */}
      <Section>
        <SectionHeading
          eyebrow="تیم ما"
          title="کسانی که کنار شما هستند"
          description="هر عضو تیم ما در حوزه‌ی خودش تخصص و مدرک دارد و دوره‌های بازآموزی را مرتب می‌گذراند."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <article
              key={member.id}
              className="group overflow-hidden rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={member.avatar || "/images/staff/dr-sharzad.svg"}
                  alt={member.name}
                  fill
                  sizes="(max-width:768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold">{member.name}</h3>
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-300">{member.title}</p>
                {member.bio && (
                  <p className="mt-4 text-sm leading-7 text-[color:var(--fg-muted)]">{member.bio}</p>
                )}
                {member.licenseNo && (
                  <p className="mt-4 border-t border-[color:var(--line)] pt-4 text-xs text-[color:var(--fg-muted)]">
                    شماره نظام پزشکی: {member.licenseNo}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center">
          <ButtonLink href="/booking" size="lg">
            رزرو نوبت با تیم ما
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
