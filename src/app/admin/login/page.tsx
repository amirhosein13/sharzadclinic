import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "ورود به پنل مدیریت", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getSession()) redirect(next || "/admin");

  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-bl from-rose-50 via-cream-50 to-cream-100 p-5 dark:from-plum-800 dark:via-plum-900 dark:to-plum-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-gradient-to-br from-rose-400 via-rose-500 to-plum-500 shadow-lift">
            <svg viewBox="0 0 24 24" className="size-7 text-white" fill="none" aria-hidden="true">
              <path
                d="M12 3c2.2 2.6 3.3 5 3.3 7.2 0 2.4-1.5 4.1-3.3 4.1s-3.3-1.7-3.3-4.1C8.7 8 9.8 5.6 12 3Z"
                fill="currentColor"
              />
              <path d="M12 14.3V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">پنل مدیریت کلینیک</h1>
          <p className="mt-2 text-sm text-[color:var(--fg-muted)]">برای ادامه وارد حساب خود شوید</p>
        </div>

        <div className="rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-8 shadow-lift">
          <LoginForm next={next} />
        </div>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-2 text-sm text-[color:var(--fg-muted)] transition-colors hover:text-rose-500"
        >
          بازگشت به سایت
          <ArrowLeft className="size-4" />
        </Link>
      </div>
    </div>
  );
}
