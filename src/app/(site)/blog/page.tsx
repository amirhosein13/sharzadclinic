import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong } from "@/lib/date";
import { cn, toFa } from "@/lib/utils";
import { Eye, FileText } from "lucide-react";

// چیدمان (site) کوکی نشستِ مشتری را می‌خواند (نام مشتری در هدر)، پس این
// صفحه هیچ‌وقت واقعاً استاتیک نمی‌شود. با revalidate، Next سرِ هر درخواست
// خطای static-to-dynamic می‌انداخت و رندر را دور می‌ریخت.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مجله زیبایی",
  description: "مقالات تخصصی درباره‌ی مراقبت از پوست و مو، لیزر، تزریقات و درمان‌های زیبایی.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const [posts, categories] = await Promise.all([
    prisma.post.findMany({
      where: { isPublished: true, ...(category ? { category: { slug: category } } : {}) },
      include: { category: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.postCategory.findMany({
      include: { _count: { select: { posts: { where: { isPublished: true } } } } },
    }),
  ]);

  const [lead, ...rest] = posts;

  return (
    <>
      <PageHero
        eyebrow="مجله‌ی زیبایی"
        title="بخوانید، بعد تصمیم بگیرید"
        description="مقالاتی که تیم پزشکی ما برای پاسخ به پرتکرارترین سؤال‌های شما نوشته است."
        breadcrumbs={[{ href: "/blog", label: "مجله" }]}
      />

      <Section className="pt-12">
        <div className="flex flex-wrap justify-center gap-2.5">
          <Chip href="/blog" active={!category}>
            همه
          </Chip>
          {categories
            .filter((c) => c._count.posts > 0)
            .map((c) => (
              <Chip key={c.id} href={`/blog?category=${c.slug}`} active={category === c.slug}>
                {c.title}
                <span className="mr-1.5 text-xs opacity-70">({toFa(c._count.posts)})</span>
              </Chip>
            ))}
        </div>

        {posts.length === 0 ? (
          <div className="mx-auto mt-20 max-w-md rounded-4xl border border-dashed border-[color:var(--line)] p-12 text-center">
            <FileText className="mx-auto size-10 text-rose-300" />
            <p className="mt-4 font-semibold">هنوز مقاله‌ای در این دسته منتشر نشده</p>
          </div>
        ) : (
          <>
            {/* مقاله‌ی شاخص */}
            {lead && (
              <Link
                href={`/blog/${lead.slug}`}
                className="group mt-14 grid gap-8 overflow-hidden rounded-[2.5rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-soft transition-shadow hover:shadow-lift lg:grid-cols-2"
              >
                <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[22rem]">
                  <Image
                    src={lead.coverImage || "/images/blog/skincare-routine.svg"}
                    alt={lead.title}
                    fill
                    priority
                    sizes="(max-width:1024px) 100vw, 50vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col justify-center p-8 lg:pl-12">
                  <div className="flex items-center gap-3">
                    <Badge tone="gold">جدیدترین</Badge>
                    {lead.category && <Badge tone="rose">{lead.category.title}</Badge>}
                  </div>
                  <h2 className="mt-5 text-2xl font-extrabold leading-tight transition-colors group-hover:text-rose-500 sm:text-3xl">
                    {lead.title}
                  </h2>
                  <p className="mt-4 text-sm leading-8 text-[color:var(--fg-muted)]">{lead.excerpt}</p>
                  <p className="mt-6 flex items-center gap-4 text-xs text-[color:var(--fg-muted)]">
                    <span>{lead.publishedAt ? formatJalaliLong(lead.publishedAt) : ""}</span>
                    <span>•</span>
                    <span>{toFa(lead.readingMinutes)} دقیقه مطالعه</span>
                    <span className="flex items-center gap-1">
                      <Eye className="size-3.5" />
                      {toFa(lead.views)}
                    </span>
                  </p>
                </div>
              </Link>
            )}

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
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
                    <h2 className="font-bold leading-7 transition-colors group-hover:text-rose-500">
                      {post.title}
                    </h2>
                    <p className="mt-2.5 line-clamp-2 flex-1 text-sm leading-7 text-[color:var(--fg-muted)]">
                      {post.excerpt}
                    </p>
                    <p className="mt-5 border-t border-[color:var(--line)] pt-4 text-xs text-[color:var(--fg-muted)]">
                      {post.publishedAt ? formatJalaliLong(post.publishedAt) : ""} • {toFa(post.readingMinutes)} دقیقه
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
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
