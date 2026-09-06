import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, ImageOff, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { GalleryForm } from "@/components/admin/forms/gallery-form";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { deleteGalleryItem, toggleGalleryPublished } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { addToGallery } from "@/app/actions/photos";
import { publishCandidates } from "@/lib/photo-publish";
import { formatJalaliLong } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const user = await guardPage("content");
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";

  const [items, services, candidates] = await Promise.all([
    prisma.galleryItem.findMany({ orderBy: { order: "asc" } }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { slug: true, title: true },
      orderBy: { order: "asc" },
    }),
    canEdit ? publishCandidates(12) : [],
  ]);

  return (
    <>
      <AdminPageHeader
        title="گالری نمونه کارها"
        description={`${toFa(items.length)} نمونه‌کار. دستگیره‌ی هر تصویر در سایت، قبل و بعد را مقایسه می‌کند.`}
        action={canEdit ? <GalleryForm services={services} /> : null}
      />

      {/* عکس‌هایی که مشتری اجازه‌ی انتشارشان را داده و هنوز اضافه نشده‌اند */}
      {candidates.length > 0 && (
        <Card className="mb-6 border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10">
          <h2 className="flex items-center gap-2 font-bold">
            <ShieldCheck className="size-4" />
            {toFa(candidates.length)} عکس آماده‌ی انتشار
          </h2>
          <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
            این مراجعین هنگام امضای رضایت‌نامه، اجازه‌ی انتشار عکسشان را داده‌اند. با افزودن به
            گالری، نمونه‌کار به‌صورت <b>منتشرنشده</b> ساخته می‌شود تا اول خودتان ببینیدش.
          </p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {candidates.map((c) => (
              <li
                key={c.treatmentId}
                className="flex items-center gap-3 rounded-2xl bg-[color:var(--bg-elevated)] p-3"
              >
                <span className="grid shrink-0 grid-cols-2 gap-0.5">
                  {[c.beforePhoto, c.afterPhoto].map((src) => (
                    <span key={src} className="relative size-12 overflow-hidden rounded-lg bg-[color:var(--bg-sunken)]">
                      {/* عکس‌های پرونده خصوصی‌اند و از مسیر محافظت‌شده می‌آیند */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="size-full object-cover" />
                    </span>
                  ))}
                </span>

                <span className="min-w-0 flex-1">
                  <Link
                    href={`/admin/customers/${c.customerId}`}
                    className="block truncate text-sm font-medium hover:text-rose-500"
                  >
                    {c.customerName}
                  </Link>
                  <span className="mt-0.5 block truncate text-xs text-[color:var(--fg-muted)]">
                    {c.serviceTitle} — {formatJalaliLong(c.performedAt)}
                  </span>
                </span>

                <ActionButton
                  action={addToGallery.bind(null, c.treatmentId)}
                  className="shrink-0 text-xs"
                >
                  <Plus className="size-3.5" />
                  افزودن
                </ActionButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title="نمونه‌کاری ثبت نشده"
          description="با دکمه‌ی «افزودن نمونه‌کار» تصویر قبل و بعد را آپلود کنید."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} padded={false} className="overflow-hidden">
              <div className="grid grid-cols-2">
                <div className="relative aspect-square">
                  <Image src={item.beforeImage} alt="قبل" fill sizes="200px" className="object-cover" />
                  <span className="absolute bottom-2 right-2 rounded-lg bg-plum-600/75 px-2 py-0.5 text-[10px] text-white">
                    قبل
                  </span>
                </div>
                <div className="relative aspect-square">
                  {item.afterImage ? (
                    <Image src={item.afterImage} alt="بعد" fill sizes="200px" className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                      بدون تصویر
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 rounded-lg bg-rose-500/85 px-2 py-0.5 text-[10px] text-white">
                    بعد
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold">{item.title}</h2>
                  {!item.isPublished && <Badge tone="neutral">پنهان</Badge>}
                </div>
                {item.description && (
                  <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
                    {item.description}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  {canEdit && (
                    <GalleryForm
                      services={services}
                      item={{
                        id: item.id,
                        title: item.title,
                        description: item.description,
                        beforeImage: item.beforeImage,
                        afterImage: item.afterImage,
                        serviceSlug: item.serviceSlug,
                        order: item.order,
                        isPublished: item.isPublished,
                      }}
                    />
                  )}
                  <ActionButton action={toggleGalleryPublished.bind(null, item.id)} className="flex-1">
                    {item.isPublished ? (
                      <>
                        <EyeOff className="size-3.5" /> پنهان کن
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" /> منتشر کن
                      </>
                    )}
                  </ActionButton>
                  <ActionButton
                    action={deleteGalleryItem.bind(null, item.id)}
                    confirm={`«${item.title}» حذف شود؟`}
                    className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
