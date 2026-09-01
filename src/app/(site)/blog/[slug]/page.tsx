import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { Prose } from "@/components/prose";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatJalaliLong } from "@/lib/date";
import { decodeSlug, toFa } from "@/lib/utils";

export const revalidate = 300;

export async function generateStaticParams() {
  const posts = await prisma.post
    .findMany({ where: { isPublished: true }, select: { slug: true } })
    .catch(() => []);
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findFirst({ where: { slug: { in: decodeSlug(slug) } } });
  if (!post) return { title: "مقاله پیدا نشد" };

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt || undefined,
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await getSettings();

  const post = await prisma.post.findFirst({
    where: { slug: { in: decodeSlug(slug) } },
    include: { category: true },
  });

  if (!post || !post.isPublished) notFound();

  // شمارنده‌ی بازدید — شکستش نباید صفحه را بیندازد
  prisma.post
    .update({ where: { id: post.id }, data: { views: { increment: 1 } } })
    .catch(() => undefined);

  const related = await prisma.post.findMany({
    where: { isPublished: true, id: { not: post.id }, categoryId: post.categoryId },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: settings.clinicName },
    publisher: { "@type": "Organization", name: settings.clinicName },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="container-page py-14">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="مسیر" className="mb-6 flex items-center gap-2 text-xs text-[color:var(--fg-muted)]">
            <Link href="/" className="hover:text-rose-500">خانه</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-rose-500">مجله</Link>
          </nav>

          {post.category && <Badge tone="rose">{post.category.title}</Badge>}

          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{post.title}</h1>

          {post.excerpt && (
            <p className="mt-5 text-base leading-8 text-[color:var(--fg-muted)]">{post.excerpt}</p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-5 border-y border-[color:var(--line)] py-4 text-xs text-[color:var(--fg-muted)]">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {post.publishedAt ? formatJalaliLong(post.publishedAt) : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" />
              {toFa(post.readingMinutes)} دقیقه مطالعه
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="size-4" />
              {toFa(post.views)} بازدید
            </span>
          </div>
        </div>

        {post.coverImage && (
          <div className="relative mx-auto mt-10 aspect-[16/9] max-w-4xl overflow-hidden rounded-4xl shadow-lift">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              priority
              sizes="(max-width:1024px) 100vw, 900px"
              className="object-cover"
            />
          </div>
        )}

        <div className="mx-auto mt-12 max-w-3xl">
          <Prose>{post.content}</Prose>

          <div className="mt-14 rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-8 text-center">
            <h2 className="text-lg font-bold">سؤالی برایتان پیش آمد؟</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[color:var(--fg-muted)]">
              جلسه‌ی مشاوره‌ی اولیه در کلینیک ما رایگان است. بیایید وضعیت شما را از نزدیک بررسی کنیم.
            </p>
            <ButtonLink href="/booking" className="mt-6">
              رزرو مشاوره‌ی رایگان
            </ButtonLink>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <h2 className="mb-8 text-xl font-bold">مطالب مرتبط</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/blog/${r.slug}`}
                  className="group overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] transition-all hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={r.coverImage || "/images/blog/skincare-routine.svg"}
                      alt={r.title}
                      fill
                      sizes="33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-sm font-bold leading-7 transition-colors group-hover:text-rose-500">
                      {r.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-16 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:underline dark:text-rose-300"
          >
            بازگشت به مجله
            <ArrowLeft className="size-4" />
          </Link>
        </div>
      </article>
    </>
  );
}
