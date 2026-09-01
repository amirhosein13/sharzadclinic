import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ServiceCard } from "@/components/service-card";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/site/page-hero";
import { cn, toFa } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "خدمات کلینیک",
  description:
    "لیزر موهای زائد، بوتاکس، فیلر، هیدرافیشیال، جوانسازی، درمان آکنه و ده‌ها خدمت تخصصی دیگر با قیمت شفاف.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;

  const [categories, services] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { isActive: true },
      include: { _count: { select: { services: { where: { isActive: true } } } } },
      orderBy: { order: "asc" },
    }),
    prisma.service.findMany({
      where: {
        isActive: true,
        ...(category ? { category: { slug: category } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { shortDescription: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: { category: { select: { title: true } } },
      orderBy: [{ isFeatured: "desc" }, { order: "asc" }],
    }),
  ]);

  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <>
      <PageHero
        eyebrow="خدمات ما"
        title={activeCategory ? activeCategory.title : "همه‌ی خدمات کلینیک"}
        description={
          activeCategory?.description ??
          "برای هر خدمت، مدت‌زمان، تعداد جلسات پیشنهادی و بازه‌ی قیمت را شفاف نوشته‌ایم."
        }
      />

      <Section className="pt-12">
        {/* فیلتر دسته‌بندی */}
        <div className="flex flex-wrap justify-center gap-2.5">
          <FilterChip href="/services" active={!category}>
            همه
            <span className="mr-1.5 text-xs opacity-70">
              ({toFa(categories.reduce((sum, c) => sum + c._count.services, 0))})
            </span>
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.id} href={`/services?category=${c.slug}`} active={category === c.slug}>
              {c.title}
              <span className="mr-1.5 text-xs opacity-70">({toFa(c._count.services)})</span>
            </FilterChip>
          ))}
        </div>

        {services.length === 0 ? (
          <div className="mx-auto mt-20 max-w-md rounded-4xl border border-dashed border-[color:var(--line)] p-12 text-center">
            <Sparkles className="mx-auto size-10 text-rose-300" />
            <p className="mt-4 font-semibold">خدمتی با این فیلتر پیدا نشد</p>
            <p className="mt-2 text-sm text-[color:var(--fg-muted)]">
              فیلتر را بردارید یا با ما تماس بگیرید تا راهنمایی‌تان کنیم.
            </p>
          </div>
        ) : (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-5 py-2.5 text-sm font-medium transition-all",
        active
          ? "border-rose-500 bg-rose-500 text-white shadow-[0_6px_18px_-8px_rgba(183,110,121,0.9)]"
          : "border-[color:var(--line)] bg-[color:var(--bg-elevated)] hover:border-rose-300 hover:text-rose-500"
      )}
    >
      {children}
    </Link>
  );
}
