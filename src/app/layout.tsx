import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import Script from "next/script";
import { Toaster } from "sonner";
import { getSettings } from "@/lib/settings";
import { ThemeScript } from "@/components/theme-toggle";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    metadataBase: new URL(base),
    title: {
      default: `${s.clinicName} | ${s.tagline}`,
      template: `%s | ${s.clinicName}`,
    },
    description: s.description,
    keywords: [
      "کلینیک زیبایی", "لیزر موهای زائد", "بوتاکس", "فیلر", "هیدرافیشیال",
      "جوانسازی پوست", "درمان آکنه", "کاشت مو", "کلینیک پوست و مو", s.clinicName,
    ],
    authors: [{ name: s.clinicName }],
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: s.clinicName,
      title: `${s.clinicName} | ${s.tagline}`,
      description: s.description,
      images: [{ url: "/images/og.svg", width: 800, height: 500, alt: s.clinicName }],
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    alternates: { canonical: "/" },
    // تأیید مالکیت سایت در گوگل سرچ کنسول
    ...(s.googleSiteVerification
      ? { verification: { google: s.googleSiteVerification } }
      : {}),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#140c11" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const gaId = settings.googleAnalyticsId?.trim();

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeScript />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-rose-500 focus:px-5 focus:py-3 focus:text-white"
        >
          پرش به محتوای اصلی
        </a>
        {children}

        {/* گوگل آنالیتیکس — فقط اگر شناسه در تنظیمات گذاشته شده باشد */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        )}

        <Toaster
          position="top-center"
          dir="rtl"
          toastOptions={{
            style: { fontFamily: "inherit", borderRadius: "1rem" },
            className: "text-sm",
          }}
        />
      </body>
    </html>
  );
}
