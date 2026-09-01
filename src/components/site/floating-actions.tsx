"use client";

import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle, Phone, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingActions({ phone, whatsapp }: { phone: string; whatsapp: string }) {
  const [open, setOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="no-print fixed bottom-5 left-5 z-40 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="بازگشت به بالا"
        className={cn(
          "grid size-11 place-items-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-soft transition-all duration-300",
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        <ArrowUp className="size-[18px]" />
      </button>

      <div className="flex flex-col items-center gap-3">
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="واتساپ"
          className={cn(
            "grid size-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lift transition-all duration-300",
            open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-75 opacity-0"
          )}
        >
          <MessageCircle className="size-5" />
        </a>
        <a
          href={`tel:${phone}`}
          aria-label="تماس تلفنی"
          className={cn(
            "grid size-12 place-items-center rounded-full bg-plum-500 text-white shadow-lift transition-all delay-75 duration-300",
            open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-75 opacity-0"
          )}
        >
          <Phone className="size-5" />
        </a>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "بستن راه‌های ارتباطی" : "راه‌های ارتباطی"}
          className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
        >
          {open ? <X className="size-6" /> : <Plus className="size-6" />}
        </button>
      </div>
    </div>
  );
}
