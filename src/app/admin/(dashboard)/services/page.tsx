import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Eye, EyeOff, Sparkles, Star, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { ServiceForm } from "@/components/admin/forms/service-form";
import { CategoryForm } from "@/components/admin/forms/category-form";
import { toggleServiceActive, toggleServiceFeatured } from "@/app/actions/admin";
import { deleteCategory, deleteService } from "@/app/actions/content";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatPriceRange, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const user = await guardPage("content");
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";

  const [categories, staff] = await Promise.all([
    prisma.serviceCategory.findMany({
      include: {
        services: {
          orderBy: { order: "asc" },
          include: { staff: { select: { staffId: true } } },
        },
      },
      orderBy: { order: "asc" },
    }),
    prisma.staff.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { order: "asc" } }),
  ]);

  const categoryOptions = categories.map((c) => ({ id: c.id, title: c.title }));
  const total = categories.reduce((sum, c) => sum + c.services.length, 0);

  return (
    <>
      <AdminPageHeader
        title="خدمات"
        description={`${toFa(total)} خدمت در ${toFa(categories.length)} دسته‌بندی.`}
        action={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <CategoryForm />
              {categoryOptions.length > 0 && <ServiceForm categories={categoryOptions} staff={staff} />}
            </div>
          ) : null
        }
      />

      {categoryOptions.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="هنوز دسته‌بندی‌ای ثبت نشده"
          description="اول یک دسته‌بندی بسازید، بعد خدمات را داخلش اضافه کنید."
        />
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category.id}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold">{category.title}</h2>
                <span className="text-xs text-[color:var(--fg-muted)]">
                  ({toFa(category.services.length)} خدمت)
                </span>
                {!category.isActive && <Badge tone="red">غیرفعال</Badge>}
                {canEdit && (
                  <div className="flex gap-1.5">
                    <CategoryForm
                      category={{
                        id: category.id,
                        title: category.title,
                        description: category.description,
                        icon: category.icon,
                        order: category.order,
                        isActive: category.isActive,
                      }}
                    />
                    <ActionButton
                      action={deleteCategory.bind(null, category.id)}
                      confirm={`دسته‌بندی «${category.title}» حذف شود؟`}
                      title="حذف دسته‌بندی"
                      className="size-8 p-0 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="size-3.5" />
                    </ActionButton>
                  </div>
                )}
              </div>

              {category.services.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[color:var(--line)] p-6 text-center text-sm text-[color:var(--fg-muted)]">
                  خدمتی در این دسته‌بندی ثبت نشده.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {category.services.map((service) => (
                    <Card key={service.id} className="flex flex-col gap-4 sm:flex-row">
                      <span className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--bg-sunken)]">
                        {service.image && (
                          <Image src={service.image} alt="" fill sizes="80px" className="object-cover" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{service.title}</h3>
                          {service.isFeatured && <Badge tone="gold">منتخب</Badge>}
                          {!service.isActive && <Badge tone="red">غیرفعال</Badge>}
                          {!service.isBookable && <Badge tone="neutral">بدون رزرو آنلاین</Badge>}
                        </div>

                        <p className="mt-1.5 line-clamp-1 text-xs text-[color:var(--fg-muted)]">
                          {service.shortDescription}
                        </p>

                        <p className="mt-2 text-xs text-[color:var(--fg-muted)]">
                          {formatPriceRange(service.priceFrom, service.priceTo)} •{" "}
                          {formatDuration(service.durationMinutes)} • بافر {toFa(service.bufferMinutes)} دقیقه
                          {service.slotStepMinutes && ` • گام ${toFa(service.slotStepMinutes)} دقیقه`}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                          {toFa(service.staff.length)} پرسنل مجاز
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {canEdit && (
                            <ServiceForm
                              categories={categoryOptions}
                              staff={staff}
                              service={{
                                id: service.id,
                                title: service.title,
                                categoryId: service.categoryId,
                                shortDescription: service.shortDescription,
                                description: service.description,
                                image: service.image,
                                priceFrom: service.priceFrom,
                                priceTo: service.priceTo,
                                durationMinutes: service.durationMinutes,
                                bufferMinutes: service.bufferMinutes,
                                slotStepMinutes: service.slotStepMinutes,
                                sessionsNeeded: service.sessionsNeeded,
                                preparation: service.preparation,
                                aftercare: service.aftercare,
                                isFeatured: service.isFeatured,
                                isBookable: service.isBookable,
                                isActive: service.isActive,
                                order: service.order,
                                staffIds: service.staff.map((s) => s.staffId),
                              }}
                            />
                          )}

                          <ActionButton action={toggleServiceActive.bind(null, service.id)}>
                            {service.isActive ? (
                              <>
                                <EyeOff className="size-3.5" /> غیرفعال
                              </>
                            ) : (
                              <>
                                <Eye className="size-3.5" /> فعال
                              </>
                            )}
                          </ActionButton>

                          <ActionButton
                            action={toggleServiceFeatured.bind(null, service.id)}
                            className={service.isFeatured ? "text-gold-600" : ""}
                            title={service.isFeatured ? "حذف از منتخب" : "افزودن به منتخب"}
                          >
                            <Star
                              className={service.isFeatured ? "size-3.5 fill-gold-400 text-gold-400" : "size-3.5"}
                            />
                          </ActionButton>

                          <Link
                            href={`/services/${service.slug}`}
                            target="_blank"
                            title="مشاهده در سایت"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>

                          {canEdit && (
                            <ActionButton
                              action={deleteService.bind(null, service.id)}
                              confirm={`خدمت «${service.title}» حذف شود؟`}
                              title="حذف خدمت"
                              className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="size-3.5" />
                            </ActionButton>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
