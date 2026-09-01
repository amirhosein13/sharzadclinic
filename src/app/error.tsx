"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
          <TriangleAlert className="size-8" />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold">مشکلی پیش آمد</h1>
        <p className="mt-4 text-sm leading-8 text-[color:var(--fg-muted)]">
          متأسفانه در بارگذاری این بخش خطایی رخ داد. لطفاً دوباره تلاش کنید؛
          اگر تکرار شد با ما تماس بگیرید.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-6 text-sm font-medium text-white transition-colors hover:bg-rose-600"
        >
          <RefreshCw className="size-4" />
          تلاش دوباره
        </button>
      </div>
    </div>
  );
}
