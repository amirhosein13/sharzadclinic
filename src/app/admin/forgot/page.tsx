import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ForgotForm } from "@/components/admin/forgot-form";

export const metadata: Metadata = { title: "بازیابی رمز پنل", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  if (await getSession()) redirect("/admin");

  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-bl from-rose-50 via-cream-50 to-cream-100 p-5 dark:from-plum-800 dark:via-plum-900 dark:to-plum-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold">بازیابی رمز عبور</h1>
          <p className="mt-2 text-sm text-[color:var(--fg-muted)]">
            رمز تازه را با یک کد پیامکی می‌گذاریم
          </p>
        </div>

        <div className="rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-8 shadow-lift">
          <ForgotForm />
        </div>
      </div>
    </div>
  );
}
