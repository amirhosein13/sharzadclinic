import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/floating-actions";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const customer = await getCustomerSession();

  const categories = await prisma.serviceCategory
    .findMany({
      where: { isActive: true },
      select: { slug: true, title: true },
      orderBy: { order: "asc" },
    })
    .catch(() => []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: settings.clinicName,
    description: settings.description,
    telephone: settings.phone,
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: "تهران",
      addressCountry: "IR",
    },
    geo: { "@type": "GeoCoordinates", latitude: settings.mapLat, longitude: settings.mapLng },
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    priceRange: "$$",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"],
        opens: "09:00",
        closes: "21:00",
      },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Thursday", opens: "09:00", closes: "17:00" },
    ],
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header
        clinicName={settings.clinicName}
        phone={settings.phone}
        customerName={customer?.name.split(" ")[0] ?? null}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer settings={settings} categories={categories} />
      <FloatingActions phone={settings.phone} whatsapp={settings.whatsapp} />
    </div>
  );
}
