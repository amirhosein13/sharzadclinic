import Link from "next/link";
import { ArrowLeft, CalendarHeart, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-bl from-rose-50 via-cream-50 to-cream-100 p-6 text-center dark:from-plum-800 dark:via-plum-900 dark:to-plum-900">
      <div className="max-w-md">
        <p className="text-7xl font-extrabold text-gradient sm:text-8xl">۴۰۴</p>
        <h1 className="mt-6 text-2xl font-extrabold">این صفحه پیدا نشد</h1>
        <p className="mt-4 text-sm leading-8 text-[color:var(--fg-muted)]">
          شاید آدرس را اشتباه وارد کرده‌اید یا این صفحه جابه‌جا شده است.
          از این‌جا می‌توانید به بقیه‌ی بخش‌ها بروید.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-6 text-sm font-medium text-white transition-colors hover:bg-rose-600"
          >
            <Home className="size-4" />
            صفحه‌ی اصلی
          </Link>
          <Link
            href="/booking"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/70 px-6 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-white/5"
          >
            <CalendarHeart className="size-4" />
            رزرو نوبت
          </Link>
        </div>

        <Link
          href="/services"
          className="mt-7 inline-flex items-center gap-2 text-sm text-[color:var(--fg-muted)] transition-colors hover:text-rose-500"
        >
          مشاهده‌ی خدمات کلینیک
          <ArrowLeft className="size-4" />
        </Link>
      </div>
    </div>
  );
}
