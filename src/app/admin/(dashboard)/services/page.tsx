import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Eye, EyeOff, Sparkles, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { ServicePricingForm } from "@/components/admin/service-pricing-form";
import { toggleServiceActive, toggleServiceFeatured } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const categories = await prisma.serviceCategory.findMany({
    include: { services: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  const total = categories.reduce((sum, c) => sum + c.services.length, 0);

  return (
    <>
      <AdminPageHeader
        title="خدمات"
        description={`${toFa(total)} خدمت در ${toFa(categories.length)} دسته‌بندی. قیمت و مدت هر خدمت را همین‌جا ویرایش کنید.`}
      />

      {total === 0 ? (
        <EmptyState icon={Sparkles} title="هنوز خدمتی ثبت نشده" />
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category.id}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                {category.title}
                <span className="text-xs font-normal text-[color:var(--fg-muted)]">
                  ({toFa(category.services.length)} خدمت)
                </span>
              </h2>

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

                      <ServicePricingForm
                        id={service.id}
                        priceFrom={service.priceFrom}
                        priceTo={service.priceTo}
                        durationMinutes={service.durationMinutes}
                      />

                      <div className="mt-4 flex flex-wrap gap-2">
                        <ActionButton
                          action={toggleServiceActive.bind(null, service.id)}
                          title={service.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}
                        >
                          {service.isActive ? (
                            <>
                              <EyeOff className="size-3.5" /> غیرفعال کن
                            </>
                          ) : (
                            <>
                              <Eye className="size-3.5" /> فعال کن
                            </>
                          )}
                        </ActionButton>

                        <ActionButton
                          action={toggleServiceFeatured.bind(null, service.id)}
                          className={service.isFeatured ? "text-gold-600" : ""}
                        >
                          <Star className={service.isFeatured ? "size-3.5 fill-gold-400 text-gold-400" : "size-3.5"} />
                          {service.isFeatured ? "حذف از منتخب" : "افزودن به منتخب"}
                        </ActionButton>

                        <Link
                          href={`/services/${service.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
                        >
                          <ExternalLink className="size-3.5" />
                          نمایش
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
