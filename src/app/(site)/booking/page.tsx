import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/site/page-hero";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { CalendarCheck, PhoneCall, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "رزرو نوبت آنلاین",
  description: "در کمتر از یک دقیقه نوبت خود را در کلینیک زیبایی شهرزاد رزرو کنید.",
  alternates: { canonical: "/booking" },
};

const PERKS = [
  { icon: CalendarCheck, title: "رزرو در کمتر از یک دقیقه", body: "بدون ثبت‌نام و بدون رمز عبور." },
  { icon: PhoneCall, title: "تأیید تلفنی", body: "همکاران ما برای قطعی‌کردن نوبت تماس می‌گیرند." },
  { icon: ShieldCheck, title: "لغو رایگان", body: "تا ۶ ساعت قبل از نوبت، بدون جریمه." },
];

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;

  const [services, staff] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true, isBookable: true },
      include: { category: { select: { title: true } } },
      orderBy: [{ isFeatured: "desc" }, { order: "asc" }],
    }),
    prisma.staff.findMany({
      where: { isActive: true, acceptsBookings: true },
      include: { services: { select: { serviceId: true } } },
      orderBy: { order: "asc" },
    }),
  ]);

  return (
    <>
      <PageHero
        eyebrow="رزرو آنلاین"
        title="نوبت خود را رزرو کنید"
        description="خدمت، متخصص و زمان دلخواهتان را انتخاب کنید. بقیه‌اش با ما."
        breadcrumbs={[{ href: "/booking", label: "رزرو نوبت" }]}
      />

      <div className="container-page py-14">
        <BookingWizard
          initialServiceSlug={service}
          services={services.map((s) => ({
            id: s.id,
            slug: s.slug,
            title: s.title,
            image: s.image,
            priceFrom: s.priceFrom,
            priceTo: s.priceTo,
            durationMinutes: s.durationMinutes,
            categoryTitle: s.category.title,
          }))}
          staff={staff.map((m) => ({
            id: m.id,
            name: m.name,
            title: m.title,
            avatar: m.avatar,
            serviceIds: m.services.map((x) => x.serviceId),
          }))}
        />

        <div className="mx-auto mt-16 grid max-w-4xl gap-5 sm:grid-cols-3">
          {PERKS.map((perk) => (
            <div
              key={perk.title}
              className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 text-center"
            >
              <perk.icon className="mx-auto size-6 text-rose-500" />
              <h2 className="mt-4 text-sm font-bold">{perk.title}</h2>
              <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">{perk.body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
