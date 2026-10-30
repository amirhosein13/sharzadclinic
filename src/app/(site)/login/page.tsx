import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";
import { OtpLogin } from "@/components/site/otp-login";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ورود به حساب",
  description: "با شماره موبایل وارد حساب خود شوید و نوبت‌هایتان را ببینید.",
  robots: { index: false },
};

export default async function CustomerLoginPage() {
  if (await getCustomerSession()) redirect("/account");

  const settings = await getSettings();
  // وقتی پیامک خاموش است، نشان‌دادن فرمِ «کد برایت می‌فرستیم» یعنی
  // وعده‌ی دروغ: کاربر شماره می‌دهد و تا ابد منتظر می‌ماند. به‌جایش
  // همان‌جا راه‌های واقعی را می‌گذاریم.
  const smsOff = (settings.smsEnabled ?? DEFAULT_SETTINGS.smsEnabled) === "0";
  const clinicPhone = settings.mobile || settings.phone || DEFAULT_SETTINGS.phone;

  return (
    <div className="container-page flex min-h-[70vh] items-center py-16">
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-8 shadow-soft">
          {smsOff ? (
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-bold">ورود با کد پیامکی</h1>
              <p className="text-sm leading-8 text-[color:var(--fg-muted)]">
                این بخش موقتاً در دسترس نیست. برای دیدن یا تغییر نوبتتان می‌توانید:
              </p>
              <Link
                href="/track"
                className="block rounded-2xl bg-rose-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-600"
              >
                نوبتم را با کد پیگیری کنم
              </Link>
              <a
                href={`tel:${clinicPhone}`}
                dir="ltr"
                className="block rounded-2xl border border-[color:var(--line)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
              >
                {clinicPhone}
              </a>
              <p className="text-xs leading-7 text-[color:var(--fg-subtle)]">
                رزرو نوبت آنلاین مثل همیشه کار می‌کند و نیازی به ورود ندارد.
              </p>
            </div>
          ) : (
            <OtpLogin />
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-7 text-[color:var(--fg-muted)]">
          هنوز نوبت نگرفته‌اید؟{" "}
          <Link href="/booking" className="text-rose-600 hover:underline dark:text-rose-300">
            رزرو نوبت آنلاین
          </Link>
          <br />
          فقط می‌خواهید یک نوبت را پیگیری کنید؟{" "}
          <Link href="/track" className="text-rose-600 hover:underline dark:text-rose-300">
            پیگیری با کد
          </Link>
        </p>
      </div>
    </div>
  );
}
