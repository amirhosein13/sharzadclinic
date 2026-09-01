import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Eye, EyeOff, FileText, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { PostForm } from "@/components/admin/forms/post-form";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { deletePost, togglePostPublished } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const user = await guardPage("content");
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";

  const [posts, categories] = await Promise.all([
    prisma.post.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }),
    prisma.postCategory.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="مجله"
        description={`${toFa(posts.length)} مقاله.`}
        action={canEdit ? <PostForm categories={categories} /> : null}
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="مقاله‌ای ثبت نشده"
          description="با دکمه‌ی «مقاله جدید» اولین مطلب مجله را بنویسید."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-[color:var(--line)]">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <span className="relative h-20 w-full shrink-0 overflow-hidden rounded-2xl bg-[color:var(--bg-sunken)] sm:w-32">
                  {post.coverImage && (
                    <Image src={post.coverImage} alt="" fill sizes="128px" className="object-cover" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{post.title}</h2>
                    {post.isPublished ? (
                      <Badge tone="green">منتشرشده</Badge>
                    ) : (
                      <Badge tone="amber">پیش‌نویس</Badge>
                    )}
                    {post.category && <Badge tone="rose">{post.category.title}</Badge>}
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-xs text-[color:var(--fg-muted)]">{post.excerpt}</p>
                  <p className="mt-1.5 text-[11px] text-[color:var(--fg-muted)]">
                    {post.publishedAt ? formatJalaliLong(post.publishedAt) : "منتشر نشده"} •{" "}
                    {toFa(post.views)} بازدید • {toFa(post.readingMinutes)} دقیقه
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {canEdit && (
                    <PostForm
                      categories={categories}
                      post={{
                        id: post.id,
                        title: post.title,
                        excerpt: post.excerpt,
                        content: post.content,
                        coverImage: post.coverImage,
                        categoryId: post.categoryId,
                        isPublished: post.isPublished,
                        metaTitle: post.metaTitle,
                        metaDescription: post.metaDescription,
                      }}
                    />
                  )}
                  <ActionButton action={togglePostPublished.bind(null, post.id)}>
                    {post.isPublished ? (
                      <>
                        <EyeOff className="size-3.5" /> پیش‌نویس
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" /> انتشار
                      </>
                    )}
                  </ActionButton>
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs transition-colors hover:bg-[color:var(--bg-sunken)]"
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                  <ActionButton
                    action={deletePost.bind(null, post.id)}
                    confirm={`مقاله‌ی «${post.title}» حذف شود؟`}
                    className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
