import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";
import { OtpLogin } from "@/components/site/otp-login";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ورود به حساب",
  description: "با شماره موبایل وارد حساب خود شوید و نوبت‌هایتان را ببینید.",
  robots: { index: false },
};

export default async function CustomerLoginPage() {
  if (await getCustomerSession()) redirect("/account");

  return (
    <div className="container-page flex min-h-[70vh] items-center py-16">
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-8 shadow-soft">
          <OtpLogin />
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
