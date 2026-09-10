import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/ui/section";
import { BeforeAfter } from "@/components/before-after";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarHeart, ImageOff } from "lucide-react";

// چیدمان (site) کوکی نشستِ مشتری را می‌خواند (نام مشتری در هدر)، پس این
// صفحه هیچ‌وقت واقعاً استاتیک نمی‌شود. با revalidate، Next سرِ هر درخواست
// خطای static-to-dynamic می‌انداخت و رندر را دور می‌ریخت.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "نمونه کارها",
  description: "تصاویر قبل و بعد از درمان‌های انجام‌شده در کلینیک زیبایی شهرزاد.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;

  const [items, services] = await Promise.all([
    prisma.galleryItem.findMany({
      where: { isPublished: true, ...(service ? { serviceSlug: service } : {}) },
      orderBy: { order: "asc" },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { slug: true, title: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const usedSlugs = new Set(
    (
      await prisma.galleryItem.findMany({
        where: { isPublished: true },
        select: { serviceSlug: true },
        distinct: ["serviceSlug"],
      })
    )
      .map((g) => g.serviceSlug)
      .filter(Boolean) as string[]
  );
  const filterable = services.filter((s) => usedSlugs.has(s.slug));

  return (
    <>
      <PageHero
        eyebrow="نتیجه‌ی واقعی"
        title="نمونه کارهای کلینیک"
        description="دستگیره‌ی هر تصویر را بکشید تا تفاوت قبل و بعد را ببینید. همه‌ی تصاویر با رضایت کتبی مراجعین منتشر شده‌اند."
        breadcrumbs={[{ href: "/gallery", label: "نمونه کارها" }]}
      />

      <Section className="pt-12">
        {filterable.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2.5">
            <Chip href="/gallery" active={!service}>
              همه
            </Chip>
            {filterable.map((s) => (
              <Chip key={s.slug} href={`/gallery?service=${s.slug}`} active={service === s.slug}>
                {s.title}
              </Chip>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <div className="mx-auto mt-20 max-w-md rounded-4xl border border-dashed border-[color:var(--line)] p-12 text-center">
            <ImageOff className="mx-auto size-10 text-rose-300" />
            <p className="mt-4 font-semibold">هنوز نمونه‌کاری برای این فیلتر ثبت نشده</p>
          </div>
        ) : (
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <figure key={item.id} className="group">
                <BeforeAfter
                  before={item.beforeImage}
                  after={item.afterImage}
                  alt={item.title}
                  className="aspect-4/5 shadow-soft transition-shadow group-hover:shadow-lift"
                />
                <figcaption className="mt-4">
                  <h2 className="text-sm font-bold">{item.title}</h2>
                  {item.description && (
                    <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
                      {item.description}
                    </p>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <div className="mt-20 rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-10 text-center">
          <h2 className="text-xl font-bold">نتیجه‌ی شما هم می‌تواند اینجا باشد</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[color:var(--fg-muted)]">
            برای بررسی وضعیت خودتان و دریافت برنامه‌ی درمانی اختصاصی، یک جلسه‌ی مشاوره‌ی رایگان رزرو کنید.
          </p>
          <ButtonLink href="/booking" size="lg" className="mt-7">
            <CalendarHeart className="size-5" />
            رزرو مشاوره‌ی رایگان
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-5 py-2.5 text-sm font-medium transition-all",
        active
          ? "border-rose-500 bg-rose-500 text-white"
          : "border-[color:var(--line)] bg-[color:var(--bg-elevated)] hover:border-rose-300 hover:text-rose-500"
      )}
    >
      {children}
    </Link>
  );
}
