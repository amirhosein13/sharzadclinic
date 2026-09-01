import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/ui/section";
import { ContactForm } from "@/components/site/contact-form";
import { toFa } from "@/lib/utils";

export const metadata: Metadata = {
  title: "تماس با ما",
  description: "آدرس، تلفن و ساعات کاری کلینیک زیبایی شهرزاد — یا همین‌جا پیام بگذارید.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSettings();

  const infoCards = [
    { icon: MapPin, title: "آدرس کلینیک", lines: [settings.address] },
    {
      icon: Phone,
      title: "تلفن تماس",
      lines: [toFa(settings.phone), toFa(settings.mobile)],
      href: `tel:${settings.phone}`,
    },
    { icon: Mail, title: "ایمیل", lines: [settings.email], href: `mailto:${settings.email}` },
    {
      icon: Clock,
      title: "ساعات کاری",
      lines: ["شنبه تا چهارشنبه: ۹ تا ۲۱", "پنجشنبه: ۹ تا ۱۷", "جمعه: تعطیل"],
    },
  ];

  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${
    Number(settings.mapLng) - 0.006
  }%2C${Number(settings.mapLat) - 0.004}%2C${Number(settings.mapLng) + 0.006}%2C${
    Number(settings.mapLat) + 0.004
  }&layer=mapnik&marker=${settings.mapLat}%2C${settings.mapLng}`;

  return (
    <>
      <PageHero
        eyebrow="در خدمت شما"
        title="تماس با ما"
        description="هر سؤالی دارید بپرسید — چه درباره‌ی خدمات، چه درباره‌ی قیمت‌ها. با کمال میل راهنمایی می‌کنیم."
        breadcrumbs={[{ href: "/contact", label: "تماس با ما" }]}
      />

      <Section className="pt-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {infoCards.map((card) => {
            const content = (
              <>
                <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white">
                  <card.icon className="size-6" />
                </div>
                <h2 className="text-sm font-bold">{card.title}</h2>
                <div className="mt-2 space-y-1">
                  {card.lines.map((line) => (
                    <p key={line} className="text-sm leading-7 text-[color:var(--fg-muted)]">
                      {line}
                    </p>
                  ))}
                </div>
              </>
            );

            return card.href ? (
              <a
                key={card.title}
                href={card.href}
                className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
              >
                {content}
              </a>
            ) : (
              <div
                key={card.title}
                className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft"
              >
                {content}
              </div>
            );
          })}
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-8 shadow-soft sm:p-10">
            <h2 className="text-2xl font-bold">پیام بگذارید</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--fg-muted)]">
              فرم زیر را پر کنید؛ در اولین فرصت کاری با شما تماس می‌گیریم.
            </p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>

          <div className="overflow-hidden rounded-4xl border border-[color:var(--line)] shadow-soft">
            <iframe
              src={mapSrc}
              title="موقعیت کلینیک روی نقشه"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-[26rem] w-full border-0"
            />
          </div>
        </div>
      </Section>
    </>
  );
}
