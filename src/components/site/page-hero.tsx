import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumbs,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: { href: string; label: string }[];
}) {
  return (
    <section className="grain relative overflow-hidden border-b border-[color:var(--line)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-rose-50 to-cream-50 dark:from-plum-800 dark:to-plum-900" />
      <div className="pointer-events-none absolute -right-20 -top-24 -z-10 size-80 rounded-full bg-rose-200/40 blur-3xl dark:bg-rose-500/8" />

      <div className="container-page py-16 text-center sm:py-20">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="مسیر صفحه" className="mb-5 flex items-center justify-center gap-1.5 text-xs text-[color:var(--fg-muted)]">
            <Link href="/" className="transition-colors hover:text-rose-500">
              خانه
            </Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.href} className="flex items-center gap-1.5">
                <ChevronLeft className="size-3.5" />
                <Link href={crumb.href} className="transition-colors hover:text-rose-500">
                  {crumb.label}
                </Link>
              </span>
            ))}
          </nav>
        )}

        {eyebrow && (
          <span className="mb-3 inline-block rounded-full border border-gold-500/30 bg-gold-500/8 px-4 py-1.5 text-xs font-medium text-gold-600 dark:text-gold-300">
            {eyebrow}
          </span>
        )}
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">{title}</h1>
        {description && (
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[color:var(--fg-muted)]">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}
