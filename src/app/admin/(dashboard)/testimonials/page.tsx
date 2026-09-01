import { Eye, EyeOff, Quote, Star, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { NewTestimonialForm } from "@/components/admin/new-testimonial-form";
import { deleteTestimonial, toggleTestimonial } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const testimonials = await prisma.testimonial.findMany({
    orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
  });

  const pending = testimonials.filter((t) => !t.isApproved).length;

  return (
    <>
      <AdminPageHeader
        title="نظرات مشتریان"
        description={
          pending > 0
            ? `${toFa(pending)} نظر در انتظار تأیید شماست.`
            : "همه‌ی نظرات بررسی شده‌اند."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card className="lg:sticky lg:top-8 lg:self-start">
          <h2 className="mb-5 font-bold">ثبت نظر جدید</h2>
          <NewTestimonialForm />
        </Card>

        <div className="space-y-4">
          {testimonials.length === 0 ? (
            <EmptyState icon={Quote} title="نظری ثبت نشده" />
          ) : (
            testimonials.map((t) => (
              <Card key={t.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{t.authorName}</h3>
                      {t.isApproved ? (
                        <Badge tone="green">منتشرشده</Badge>
                      ) : (
                        <Badge tone="amber">در انتظار تأیید</Badge>
                      )}
                    </div>
                    {t.serviceName && (
                      <p className="mt-1 text-xs text-[color:var(--fg-muted)]">{t.serviceName}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5" aria-label={`امتیاز ${toFa(t.rating)} از ۵`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={
                          i < t.rating
                            ? "size-3.5 fill-gold-400 text-gold-400"
                            : "size-3.5 text-[color:var(--line)]"
                        }
                      />
                    ))}
                  </div>
                </div>

                <p className="mt-4 text-sm leading-8 text-[color:var(--fg-muted)]">«{t.body}»</p>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[color:var(--line)] pt-4">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">
                    {formatJalaliLong(t.createdAt)}
                  </p>
                  <div className="flex gap-2">
                    <ActionButton action={toggleTestimonial.bind(null, t.id)}>
                      {t.isApproved ? (
                        <>
                          <EyeOff className="size-3.5" /> برداشتن از سایت
                        </>
                      ) : (
                        <>
                          <Eye className="size-3.5" /> تأیید و انتشار
                        </>
                      )}
                    </ActionButton>
                    <ActionButton
                      action={deleteTestimonial.bind(null, t.id)}
                      confirm="این نظر حذف شود؟"
                      className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="size-3.5" />
                    </ActionButton>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
