"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { GripVertical } from "lucide-react";

/**
 * اسلایدر مقایسه‌ی قبل/بعد — با ماوس، لمس و کیبورد کار می‌کند.
 * چون سایت راست‌به‌چپ است، تصویر «قبل» سمت راست قرار می‌گیرد.
 */
export function BeforeAfter({
  before,
  after,
  alt,
  className = "",
}: {
  before: string;
  after: string | null;
  alt: string;
  className?: string;
}) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  }, []);

  if (!after) {
    return (
      <div className={`relative overflow-hidden rounded-3xl ${className}`}>
        <Image src={before} alt={alt} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-3xl ${className}`}
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromClientX(e.clientX);
      }}
      onMouseMove={(e) => dragging.current && updateFromClientX(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      {/* تصویر بعد (لایه‌ی زیرین) */}
      <Image src={after} alt={`${alt} — بعد`} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />

      {/* تصویر قبل، بریده‌شده تا موقعیت اسلایدر */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        <Image src={before} alt={`${alt} — قبل`} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
      </div>

      <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-plum-600/75 px-3 py-1 text-xs font-medium text-white backdrop-blur">
        قبل
      </span>
      <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-rose-500/85 px-3 py-1 text-xs font-medium text-white backdrop-blur">
        بعد
      </span>

      {/* دستگیره */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${position}%` }}>
        <div className="absolute inset-y-0 -translate-x-1/2 border-x border-white/80 bg-white/90 shadow-lg" style={{ width: 3 }} />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="grid size-11 place-items-center rounded-full bg-white text-plum-600 shadow-lift">
            <GripVertical className="size-5" />
          </div>
        </div>
      </div>

      {/* کنترل دسترس‌پذیر با کیبورد */}
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label={`مقایسه‌ی قبل و بعد — ${alt}`}
        className="absolute inset-x-0 bottom-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
