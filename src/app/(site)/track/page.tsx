import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { TrackForm } from "@/components/site/track-form";

export const metadata: Metadata = {
  title: "پیگیری نوبت",
  description: "وضعیت نوبت خود را با کد پیگیری و شماره موبایل ببینید.",
  alternates: { canonical: "/track" },
};

export default function TrackPage() {
  return (
    <>
      <PageHero
        eyebrow="پیگیری"
        title="وضعیت نوبت شما"
        description="کد پیگیری و شماره موبایلی که با آن نوبت گرفته‌اید را وارد کنید."
        breadcrumbs={[{ href: "/track", label: "پیگیری نوبت" }]}
      />
      <div className="container-page py-14">
        <TrackForm />
      </div>
    </>
  );
}
