"use client";

import { useEffect, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";

/**
 * پوشش جدول‌های پنل.
 *
 * جدول‌ها روی گوشی جا نمی‌شوند و باید کنار بروند. مشکل این است که کاربر
 * نمی‌فهمد می‌تواند جدول را بکشد. این کامپوننت وقتی — و فقط وقتی — جدول
 * واقعاً از عرض بیرون زده باشد، یک راهنمای کوچک نشان می‌دهد و لبه‌ی
 * بیرون‌زده را محو می‌کند تا معلوم شود ادامه دارد.
 */
export function TableScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const extra = el.scrollWidth - el.clientWidth;
      setOverflowing(extra > 4);
      // در RTL مقدار scrollLeft منفی است؛ با قدرمطلق کار می‌کنیم
      setAtEnd(extra > 4 && Math.abs(el.scrollLeft) >= extra - 4);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // اگر ردیف‌ها بعداً عوض شوند، عرض هم عوض می‌شود
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener("scroll", measure, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className="overflow-x-auto">
        {children}
      </div>

      {/* محوشدن لبه: نشان می‌دهد جدول ادامه دارد */}
      {overflowing && !atEnd && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-l from-transparent to-[color:var(--bg-elevated)]"
        />
      )}

      {overflowing && (
        <p className="flex items-center justify-center gap-1.5 border-t border-[color:var(--line)] py-2 text-[11px] text-[color:var(--fg-muted)] lg:hidden">
          <MoveHorizontal className="size-3.5" />
          برای دیدن بقیه‌ی ستون‌ها، جدول را با انگشت بکشید
        </p>
      )}
    </div>
  );
}
