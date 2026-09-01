import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CalendarHeart, CircleCheck, Clock, Phone, RefreshCw, ShieldCheck, Timer,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { FaqAccordion } from "@/components/faq-accordion";
import { ServiceCard } from "@/components/service-card";
import { Prose } from "@/components/prose";
import { formatDuration, formatPriceRange } from "@/lib/utils";

export const revalidate = 300;

export async function generateStaticParams() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: { slug: true },
  }).catch(() => []);
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await prisma.service.findUnique({ where: { slug } });
  if (!service) return { title: "خدمت پیدا نشد" };

  return {
    title: service.metaTitle || service.title,
    description: service.metaDescription || service.shortDescription || undefined,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: {
      title: service.metaTitle || service.title,
      description: service.metaDescription || service.shortDescription || undefined,
      images: service.image ? [{ url: service.image }] : undefined,
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const settings = await getSettings();

  const service = await prisma.service.findUnique({
    where: { slug },
    include: {
      category: true,
      faqs: { orderBy: { order: "asc" } },
      staff: { include: { staff: true } },
    },
  });

  if (!service || !service.isActive) notFound();

  const related = await prisma.service.findMany({
    where: { isActive: true, categoryId: service.categoryId, id: { not: service.id } },
    include: { category: { select: { title: true } } },
    take: 3,
    orderBy: { order: "asc" },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.shortDescription,
    provider: { "@type": "MedicalBusiness", name: settings.clinicName },
    areaServed: "تهران",
    ...(service.priceFrom
      ? {
          offers: {
            "@type": "Offer",
            price: service.priceFrom,
            priceCurrency: "IRR",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  const facts = [
    { icon: Clock, label: "مدت هر جلسه", value: formatDuration(service.durationMinutes) },
    ...(service.sessionsNeeded
      ? [{ icon: RefreshCw, label: "تعداد جلسات", value: service.sessionsNeeded }]
      : []),
    { icon: Timer, label: "بازه‌ی قیمت", value: formatPriceRange(service.priceFrom, service.priceTo) },
    { icon: ShieldCheck, label: "متریال", value: "اورجینال با کد رهگیری" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHero
        eyebrow={service.category.title}
        title={service.title}
        description={service.shortDescription ?? undefined}
        breadcrumbs={[
          { href: "/services", label: "خدمات" },
          { href: `/services/${service.slug}`, label: service.title },
        ]}
      />

      <Section className="pt-14">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          {/* محتوای اصلی */}
          <div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-4xl shadow-lift">
              <Image
                src={service.image || "/images/services/consultation.svg"}
                alt={service.title}
                fill
                priority
                sizes="(max-width:1024px) 100vw, 60vw"
                className="object-cover"
              />
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5 text-center"
                >
                  <fact.icon className="mx-auto size-5 text-rose-500" />
                  <p className="mt-3 text-[11px] text-[color:var(--fg-muted)]">{fact.label}</p>
                  <p className="mt-1 text-xs font-semibold leading-6">{fact.value}</p>
                </div>
              ))}
            </div>

            {service.description && (
              <Prose className="mt-12">{service.description}</Prose>
            )}

            {(service.preparation || service.aftercare) && (
              <div className="mt-12 grid gap-5 sm:grid-cols-2">
                {service.preparation && (
                  <CareCard title="قبل از مراجعه" body={service.preparation} tone="rose" />
                )}
                {service.aftercare && (
                  <CareCard title="مراقبت‌های بعد از جلسه" body={service.aftercare} tone="gold" />
                )}
              </div>
            )}

            {service.faqs.length > 0 && (
              <div className="mt-14">
                <h2 className="mb-6 text-2xl font-bold">سوالات متداول درباره‌ی {service.title}</h2>
                <FaqAccordion items={service.faqs.map((f) => ({ question: f.question, answer: f.answer }))} />
              </div>
            )}
          </div>

          {/* ستون کناری */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft">
              <p className="text-xs text-[color:var(--fg-muted)]">هزینه‌ی این خدمت</p>
              <p className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-300">
                {formatPriceRange(service.priceFrom, service.priceTo)}
              </p>
              <p className="mt-2 text-xs leading-6 text-[color:var(--fg-muted)]">
                قیمت نهایی پس از بررسی حضوری و بر اساس ناحیه و وضعیت شما تعیین می‌شود.
              </p>

              {service.isBookable ? (
                <ButtonLink href={`/booking?service=${service.slug}`} size="lg" className="mt-6 w-full">
                  <CalendarHeart className="size-5" />
                  رزرو نوبت
                </ButtonLink>
              ) : (
                <p className="mt-6 rounded-2xl bg-[color:var(--bg-sunken)] p-4 text-center text-sm">
                  برای این خدمت لطفاً تلفنی هماهنگ کنید.
                </p>
              )}

              <a
                href={`tel:${settings.phone}`}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] text-sm font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
              >
                <Phone className="size-4" />
                مشاوره تلفنی رایگان
              </a>

              {service.staff.length > 0 && (
                <div className="mt-8 border-t border-[color:var(--line)] pt-6">
                  <p className="mb-4 text-sm font-semibold">متخصصان این خدمت</p>
                  <ul className="space-y-4">
                    {service.staff.map(({ staff }) => (
                      <li key={staff.id} className="flex items-center gap-3">
                        <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
                          {staff.avatar && (
                            <Image src={staff.avatar} alt={staff.name} fill sizes="44px" className="object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{staff.name}</span>
                          <span className="block truncate text-xs text-[color:var(--fg-muted)]">{staff.title}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </Section>

      {related.length > 0 && (
        <Section className="bg-[color:var(--bg-sunken)]">
          <SectionHeading eyebrow="شاید مفید باشد" title={`خدمات دیگر در ${service.category.title}`} />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:underline dark:text-rose-300"
            >
              بازگشت به همه‌ی خدمات
              <ArrowLeft className="size-4" />
            </Link>
          </div>
        </Section>
      )}
    </>
  );
}

function CareCard({ title, body, tone }: { title: string; body: string; tone: "rose" | "gold" }) {
  return (
    <div
      className={
        tone === "rose"
          ? "rounded-3xl border border-rose-200/70 bg-rose-50/50 p-6 dark:border-rose-300/15 dark:bg-rose-500/5"
          : "rounded-3xl border border-gold-500/25 bg-gold-500/5 p-6"
      }
    >
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <CircleCheck className={tone === "rose" ? "size-4 text-rose-500" : "size-4 text-gold-600"} />
        {title}
      </h3>
      <p className="mt-3 text-sm leading-8 text-[color:var(--fg-muted)]">{body}</p>
    </div>
  );
}
