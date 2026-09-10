import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, BadgeCheck, CalendarHeart, Gem, Heart, Phone, Scissors,
  Sparkles, Stethoscope, Syringe, TrendingUp, Zap,
} from "lucide-react";
import { prisma, safeQuery } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { FAQS } from "../../../prisma/seed-data";
import { Hero } from "@/components/home/hero";
import { Stats } from "@/components/home/stats";
import { Testimonials } from "@/components/home/testimonials";
import { ServiceCard } from "@/components/service-card";
import { BeforeAfter } from "@/components/before-after";
import { FaqAccordion } from "@/components/faq-accordion";
import { Section, SectionHeading } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong } from "@/lib/date";
import { toFa } from "@/lib/utils";

// چیدمان (site) کوکی نشستِ مشتری را می‌خواند (نام مشتری در هدر)، پس این
// صفحه هیچ‌وقت واقعاً استاتیک نمی‌شود. با revalidate، Next سرِ هر درخواست
// خطای static-to-dynamic می‌انداخت و رندر را دور می‌ریخت.
export const dynamic = "force-dynamic";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Syringe, Sparkles, TrendingUp, Scissors, Heart, Stethoscope, Gem,
};

const WHY_US = [
  {
    icon: BadgeCheck,
    title: "متریال اورجینال، بدون استثنا",
    body: "جعبه و کد رهگیری هر محصول تزریقی، پیش از استفاده به خودتان نشان داده می‌شود.",
  },
  {
    icon: Stethoscope,
    title: "تشخیص قبل از فروش",
    body: "اول وضعیت پوست و موی شما بررسی می‌شود، بعد درمان پیشنهاد می‌شود — نه برعکس.",
  },
  {
    icon: Gem,
    title: "دستگاه‌های نسل جدید",
    body: "لیزر دایود سه‌موجی، هایفو و آر‌اف با سرویس و کالیبراسیون دوره‌ای.",
  },
  {
    icon: Heart,
    title: "پیگیری بعد از درمان",
    body: "بین جلسات با شما در تماس می‌مانیم تا مسیر درمان درست پیش برود.",
  },
];

/** همه‌ی داده‌های صفحه‌ی اصلی در یک رفت‌وبرگشت */
function loadHomeData() {
  return Promise.all([
    prisma.service.findMany({
      where: { isActive: true, isFeatured: true },
      include: { category: { select: { title: true } } },
      orderBy: { order: "asc" },
      take: 6,
    }),
    prisma.serviceCategory.findMany({
      where: { isActive: true },
      include: { _count: { select: { services: { where: { isActive: true } } } } },
      orderBy: { order: "asc" },
    }),
    prisma.galleryItem.findMany({
      where: { isPublished: true },
      orderBy: { order: "asc" },
      take: 4,
    }),
    prisma.testimonial.findMany({
      where: { isApproved: true },
      orderBy: { order: "asc" },
      take: 9,
    }),
    prisma.post.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: { category: { select: { title: true } } },
    }),
  ]);
}

/** اگر دیتابیس در زمان build در دسترس نباشد، صفحه با این مقدار خالی ساخته می‌شود */
const EMPTY_HOME_DATA = [[], [], [], [], []] as unknown as Awaited<
  ReturnType<typeof loadHomeData>
>;

export default async function HomePage() {
  const settings = await getSettings();

  const [featured, categories, gallery, testimonials, posts] = await safeQuery(
    loadHomeData(),
    EMPTY_HOME_DATA
  );

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <Hero tagline={settings.tagline} clinicName={settings.clinicName} />

      {/* آمار */}
      <div className="container-page -mt-10 mb-4 sm:-mt-14">
        <Stats />
      </div>

      {/* دسته‌بندی خدمات */}
      <Section>
        <SectionHeading
          eyebrow="تخصص‌های ما"
          title="در چه زمینه‌هایی کنارتان هستیم"
          description="هر دسته، مجموعه‌ای از خدمات تخصصی با پروتکل‌های مشخص و متخصص اختصاصی خودش را دارد."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon ?? ""] ?? Sparkles;
            return (
              <Link
                key={cat.id}
                href={`/services?category=${cat.slug}`}
                className="group relative overflow-hidden rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-rose-300/60 hover:shadow-lift"
              >
                <div className="absolute -left-8 -top-8 size-28 rounded-full bg-rose-100/50 transition-transform duration-500 group-hover:scale-150 dark:bg-rose-500/8" />
                <div className="relative">
                  <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-[0_8px_20px_-8px_rgba(183,110,121,0.9)]">
                    <Icon className="size-7" />
                  </div>
                  <h3 className="text-lg font-bold">{cat.title}</h3>
                  <p className="mt-2.5 line-clamp-2 text-sm leading-7 text-[color:var(--fg-muted)]">
                    {cat.description}
                  </p>
                  <p className="mt-5 flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-300">
                    {toFa(cat._count.services)} خدمت
                    <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* خدمات منتخب */}
      <Section className="bg-[color:var(--bg-sunken)]">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            align="start"
            eyebrow="محبوب‌ترین‌ها"
            title="خدمات منتخب کلینیک"
            description="پرتقاضاترین خدماتی که مراجعین ما بیشترین رضایت را از آن‌ها داشته‌اند."
            className="max-w-xl"
          />
          <ButtonLink href="/services" variant="outline" className="shrink-0">
            همه‌ی خدمات
            <ArrowLeft className="size-4" />
          </ButtonLink>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </Section>

      {/* چرا ما */}
      <Section>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="relative">
            <div className="relative aspect-4/3 overflow-hidden rounded-[2.5rem] shadow-lift">
              <Image
                src="/images/about.svg"
                alt="محیط کلینیک"
                fill
                sizes="(max-width:1024px) 90vw, 45vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-8 -left-4 hidden w-56 rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5 shadow-lift sm:block lg:-left-8">
              <p className="text-sm font-semibold">مجوز رسمی وزارت بهداشت</p>
              <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
                فعالیت از سال {toFa(settings.establishedYear)} با پروانه‌ی معتبر
              </p>
            </div>
          </div>

          <div>
            <SectionHeading
              align="start"
              eyebrow="چرا کلینیک شهرزاد"
              title="تفاوت در جزئیاتی است که دیده نمی‌شود"
              description="ما ترجیح می‌دهیم یک درمان را انجام ندهیم تا اینکه بد انجامش دهیم. این ساده‌ترین توضیح فلسفه‌ی کاری ماست."
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {WHY_US.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
                    <item.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-7 text-[color:var(--fg-muted)]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* نمونه کارها */}
      {gallery.length > 0 && (
        <Section className="bg-[color:var(--bg-sunken)]">
          <SectionHeading
            eyebrow="نتیجه‌ی واقعی"
            title="قبل و بعد از درمان"
            description="دستگیره را بکشید تا تفاوت را ببینید. همه‌ی تصاویر با رضایت کتبی مراجعین منتشر شده‌اند."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {gallery.map((item) => (
              <figure key={item.id}>
                <BeforeAfter
                  before={item.beforeImage}
                  after={item.afterImage}
                  alt={item.title}
                  className="aspect-4/3 shadow-soft"
                />
                <figcaption className="mt-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    {item.description && (
                      <p className="mt-1 text-xs text-[color:var(--fg-muted)]">{item.description}</p>
                    )}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-12 text-center">
            <ButtonLink href="/gallery" variant="outline" size="lg">
              مشاهده‌ی همه‌ی نمونه کارها
              <ArrowLeft className="size-4" />
            </ButtonLink>
          </div>
        </Section>
      )}

      {/* نظرات */}
      {testimonials.length > 0 && (
        <Section>
          <SectionHeading
            eyebrow="از زبان مراجعین"
            title="چیزی که درباره‌ی ما می‌گویند"
            description="نظرات ثبت‌شده توسط مراجعین واقعی کلینیک، بدون ویرایش."
          />
          <div className="mt-14 -mx-3">
            <Testimonials items={testimonials} />
          </div>
        </Section>
      )}

      {/* مجله */}
      {posts.length > 0 && (
        <Section className="bg-[color:var(--bg-sunken)]">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading
              align="start"
              eyebrow="مجله‌ی زیبایی"
              title="بخوانید، بعد تصمیم بگیرید"
              description="مقالاتی که تیم پزشکی ما برای پاسخ به پرتکرارترین سؤال‌های شما نوشته است."
              className="max-w-xl"
            />
            <ButtonLink href="/blog" variant="outline" className="shrink-0">
              همه‌ی مقالات
              <ArrowLeft className="size-4" />
            </ButtonLink>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={post.coverImage || "/images/blog/skincare-routine.svg"}
                    alt={post.title}
                    fill
                    sizes="(max-width:768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  {post.category && (
                    <Badge tone="rose" className="mb-3 self-start">
                      {post.category.title}
                    </Badge>
                  )}
                  <h3 className="font-bold leading-7 transition-colors group-hover:text-rose-500">
                    {post.title}
                  </h3>
                  <p className="mt-2.5 line-clamp-2 flex-1 text-sm leading-7 text-[color:var(--fg-muted)]">
                    {post.excerpt}
                  </p>
                  <p className="mt-5 text-xs text-[color:var(--fg-muted)]">
                    {post.publishedAt ? formatJalaliLong(post.publishedAt) : ""} • {toFa(post.readingMinutes)} دقیقه مطالعه
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* سوالات متداول */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionHeading
            align="start"
            eyebrow="سوالات متداول"
            title="هر چیزی که ممکن است بپرسید"
            description="اگر جواب سؤالتان اینجا نبود، با ما تماس بگیرید — با کمال میل راهنمایی می‌کنیم."
          />
          <FaqAccordion items={FAQS.map((f) => ({ question: f.q, answer: f.a }))} />
        </div>
      </Section>

      {/* دعوت به اقدام */}
      <section className="container-page pb-24">
        <div className="grain relative overflow-hidden rounded-[2.5rem] bg-gradient-to-bl from-plum-500 via-plum-600 to-plum-700 px-8 py-16 text-center text-cream-50 sm:px-16">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-rose-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-gold-400/20 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <Sparkles className="mx-auto size-9 text-gold-300" />
            <h2 className="mt-6 text-3xl font-extrabold leading-tight sm:text-4xl">
              اولین قدم، یک مشاوره‌ی رایگان است
            </h2>
            <p className="mt-5 text-base leading-8 text-cream-100/80">
              بدون هیچ تعهدی بیایید، وضعیت پوست و مویتان را بررسی کنیم و گزینه‌های پیش‌رو را
              با هزینه‌ی تقریبی برایتان توضیح دهیم.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/booking" variant="gold" size="lg" className="w-full sm:w-auto">
                <CalendarHeart className="size-5" />
                رزرو نوبت آنلاین
              </ButtonLink>
              <a
                href={`tel:${settings.phone}`}
                className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border border-white/25 px-8 text-base font-medium transition-colors hover:bg-white/10 sm:w-auto"
              >
                <Phone className="size-5" />
                {toFa(settings.phone)}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
