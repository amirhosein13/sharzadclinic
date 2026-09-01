"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart, Menu, Phone, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn, toFa } from "@/lib/utils";

const NAV = [
  { href: "/", label: "خانه" },
  { href: "/services", label: "خدمات" },
  { href: "/gallery", label: "نمونه کارها" },
  { href: "/about", label: "درباره ما" },
  { href: "/blog", label: "مجله" },
  { href: "/contact", label: "تماس با ما" },
];

export function Header({ clinicName, phone }: { clinicName: string; phone: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* نوار بالایی */}
      <div className="hidden bg-plum-500 text-cream-100 lg:block">
        <div className="container-page flex h-10 items-center justify-between text-xs">
          <p className="opacity-90">شنبه تا چهارشنبه ۹ تا ۲۱ • پنجشنبه ۹ تا ۱۷</p>
          <a href={`tel:${phone}`} className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Phone className="size-3.5" />
            <span className="font-medium tracking-wide">{toFa(phone)}</span>
          </a>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300",
          scrolled
            ? "glass border-b border-[color:var(--line)] shadow-[0_4px_24px_-12px_rgba(74,37,69,0.25)]"
            : "bg-transparent"
        )}
      >
        <div className="container-page flex h-18 items-center justify-between gap-4 py-3">
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <Logo />
            <span className="hidden text-lg font-bold leading-tight sm:block">
              {clinicName.replace("کلینیک زیبایی ", "")}
              <span className="block text-[11px] font-normal tracking-widest text-[color:var(--fg-muted)]">
                BEAUTY CLINIC
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="منوی اصلی">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "text-rose-600 dark:text-rose-300"
                    : "text-[color:var(--fg)] hover:text-rose-500"
                )}
              >
                {item.label}
                {isActive(item.href) && (
                  <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-l from-rose-500 to-gold-500" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ButtonLink href="/booking" size="sm" className="hidden sm:inline-flex">
              <CalendarHeart className="size-4" />
              رزرو نوبت
            </ButtonLink>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="باز کردن منو"
              className="grid size-10 place-items-center rounded-full border border-[color:var(--line)] lg:hidden"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* منوی موبایل */}
      <div
        className={cn(
          "fixed inset-0 z-[60] lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-plum-900/50 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <aside
          className={cn(
            "absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-[color:var(--bg-elevated)] shadow-2xl transition-transform duration-300 ease-[var(--ease-out-expo)]",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-[color:var(--line)] p-5">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="font-bold">{clinicName}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن منو"
              className="grid size-10 place-items-center rounded-full hover:bg-[color:var(--bg-sunken)]"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4" aria-label="منوی موبایل">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-2xl px-4 py-3.5 text-base font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200"
                    : "hover:bg-[color:var(--bg-sunken)]"
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/track"
              className="block rounded-2xl px-4 py-3.5 text-base font-medium hover:bg-[color:var(--bg-sunken)]"
            >
              پیگیری نوبت
            </Link>
          </nav>

          <div className="space-y-3 border-t border-[color:var(--line)] p-5">
            <ButtonLink href="/booking" size="lg" className="w-full">
              <CalendarHeart className="size-5" />
              رزرو نوبت آنلاین
            </ButtonLink>
            <a
              href={`tel:${phone}`}
              className="flex items-center justify-center gap-2 text-sm text-[color:var(--fg-muted)]"
            >
              <Phone className="size-4" />
              {toFa(phone)}
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}

function Logo() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 via-rose-500 to-plum-500 shadow-[0_6px_18px_-6px_rgba(183,110,121,0.8)]">
      <svg viewBox="0 0 24 24" className="size-6 text-white" fill="none" aria-hidden="true">
        <path
          d="M12 3c2.2 2.6 3.3 5 3.3 7.2 0 2.4-1.5 4.1-3.3 4.1s-3.3-1.7-3.3-4.1C8.7 8 9.8 5.6 12 3Z"
          fill="currentColor"
          opacity=".95"
        />
        <path
          d="M12 14.3V21M8.5 17.5c1.2.6 2.3.9 3.5.9s2.3-.3 3.5-.9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
