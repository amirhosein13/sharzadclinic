import Link from "next/link";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import type { SettingsMap } from "@/lib/settings";
import { toFa } from "@/lib/utils";

const QUICK_LINKS = [
  { href: "/services", label: "همه‌ی خدمات" },
  { href: "/booking", label: "رزرو نوبت آنلاین" },
  { href: "/track", label: "پیگیری نوبت" },
  { href: "/gallery", label: "نمونه کارها" },
  { href: "/blog", label: "مجله زیبایی" },
  { href: "/about", label: "درباره‌ی ما" },
  { href: "/login", label: "حساب کاربری من" },
];

const HOURS = [
  { day: "شنبه تا چهارشنبه", time: "۹:۰۰ تا ۲۱:۰۰" },
  { day: "پنجشنبه", time: "۹:۰۰ تا ۱۷:۰۰" },
  { day: "جمعه", time: "تعطیل" },
];

export function Footer({
  settings,
  categories,
}: {
  settings: SettingsMap;
  categories: { slug: string; title: string }[];
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[color:var(--line)] bg-plum-600 text-cream-100">
      <div className="container-page py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* معرفی */}
          <div>
            <h3 className="mb-4 text-xl font-bold">{settings.clinicName}</h3>
            <p className="text-sm leading-7 text-cream-100/70">{settings.description}</p>
            <div className="mt-6 flex gap-3">
              {settings.instagram && (
                <SocialLink href={settings.instagram} label="اینستاگرام">
                  <InstagramIcon />
                </SocialLink>
              )}
              {settings.telegram && (
                <SocialLink href={settings.telegram} label="تلگرام">
                  <Send className="size-[18px]" />
                </SocialLink>
              )}
              {settings.whatsapp && (
                <SocialLink href={`https://wa.me/${settings.whatsapp}`} label="واتساپ">
                  <WhatsAppIcon />
                </SocialLink>
              )}
            </div>
          </div>

          {/* دسترسی سریع */}
          <div>
            <h4 className="mb-5 font-semibold">دسترسی سریع</h4>
            <ul className="space-y-3 text-sm">
              {QUICK_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-cream-100/70 transition-colors hover:text-gold-300">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* دسته‌بندی خدمات */}
          <div>
            <h4 className="mb-5 font-semibold">دسته‌بندی خدمات</h4>
            <ul className="space-y-3 text-sm">
              {categories.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/services?category=${c.slug}`}
                    className="text-cream-100/70 transition-colors hover:text-gold-300"
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* تماس */}
          <div>
            <h4 className="mb-5 font-semibold">تماس با ما</h4>
            <ul className="space-y-4 text-sm text-cream-100/70">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-[18px] shrink-0 text-gold-400" />
                <span className="leading-7">{settings.address}</span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-[18px] shrink-0 text-gold-400" />
                <a href={`tel:${settings.phone}`} className="transition-colors hover:text-gold-300">
                  {toFa(settings.phone)}
                </a>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-[18px] shrink-0 text-gold-400" />
                <a href={`mailto:${settings.email}`} className="transition-colors hover:text-gold-300">
                  {settings.email}
                </a>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-[18px] shrink-0 text-gold-400" />
                <div className="space-y-1.5">
                  {HOURS.map((h) => (
                    <p key={h.day} className="flex gap-2">
                      <span>{h.day}:</span>
                      <span className="font-medium text-cream-100">{h.time}</span>
                    </p>
                  ))}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-cream-100/55 sm:flex-row">
          <p>
            © {toFa(year)} {settings.clinicName} — تمامی حقوق محفوظ است.
          </p>
          <div className="flex items-center gap-4">
            <p>ساخته‌شده با ❤️ برای زیبایی شما</p>
            <Link href="/admin" className="transition-colors hover:text-gold-300">
              ورود کارکنان
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full border border-white/15 transition-all hover:-translate-y-0.5 hover:border-gold-400 hover:bg-white/5 hover:text-gold-300"
    >
      {children}
    </a>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.63.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.66-1.6-.9-2.18-.24-.58-.48-.5-.66-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46s1.06 2.86 1.2 3.06c.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.7.22 1.35.19 1.86.12.57-.09 1.75-.72 2-1.41.24-.7.24-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.32 4.94L2 22l5.34-1.4a9.83 9.83 0 0 0 4.7 1.2h.01c5.44 0 9.87-4.43 9.87-9.87S17.48 2 12.04 2Zm0 18.05h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.15 8.15 0 0 1-1.25-4.34c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.17-8.2 8.17Z" />
    </svg>
  );
}
