import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/site/page-hero";
import { FeedbackForm } from "@/components/site/feedback-form";
import { FEEDBACK_ASPECTS } from "@/lib/feedback";
import { formatJalaliLong } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "نظرسنجی",
  robots: { index: false, follow: false },
};

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const feedback = await prisma.feedback.findUnique({
    where: { token },
    include: {
      customer: { select: { firstName: true } },
      service: { select: { title: true } },
      appointment: { select: { startsAt: true } },
    },
  });
  if (!feedback) notFound();

  const serviceTitle = feedback.service?.title ?? "خدمتی که دریافت کردید";

  return (
    <>
      <PageHero
        eyebrow="نظر شما"
        title="یک دقیقه وقت دارید؟"
        description="نظرتان مستقیم به دست مدیر کلینیک می‌رسد و روی کاری که انجام می‌دهیم اثر می‌گذارد."
        breadcrumbs={[{ href: `/feedback/${token}`, label: "نظرسنجی" }]}
      />

      <div className="container-page py-14">
        <div className="mx-auto max-w-2xl">
          {feedback.appointment && (
            <p className="mb-6 rounded-2xl bg-[color:var(--bg-sunken)] p-4 text-center text-sm text-[color:var(--fg-muted)]">
              مراجعه‌ی {formatJalaliLong(feedback.appointment.startsAt)} — {serviceTitle}
            </p>
          )}

          {feedback.submittedAt ? (
            <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-10 text-center shadow-soft">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CircleCheck className="size-8" />
              </span>
              <h2 className="mt-6 text-xl font-bold">نظر شما قبلاً ثبت شده</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-[color:var(--fg-muted)]">
                ممنون از وقتی که گذاشتید. اگر حرف تازه‌ای دارید، خوشحال می‌شویم تلفنی بشنویم.
              </p>
            </div>
          ) : (
            <FeedbackForm
              token={token}
              aspects={[...FEEDBACK_ASPECTS]}
              customerName={feedback.customer.firstName}
              serviceTitle={serviceTitle}
            />
          )}
        </div>
      </div>
    </>
  );
}
