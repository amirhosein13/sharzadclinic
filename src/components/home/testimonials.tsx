"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { toFa } from "@/lib/utils";

export type TestimonialItem = {
  id: string;
  authorName: string;
  serviceName: string | null;
  rating: number;
  body: string;
};

export function Testimonials({ items }: { items: TestimonialItem[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", direction: "rtl" },
    [Autoplay({ delay: 5500, stopOnInteraction: true })]
  );
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {items.map((t) => (
            <div key={t.id} className="min-w-0 shrink-0 grow-0 basis-full px-3 sm:basis-1/2 lg:basis-1/3">
              <figure className="flex h-full flex-col rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-7 shadow-soft">
                <div className="mb-4 flex items-center gap-1" aria-label={`امتیاز ${toFa(t.rating)} از ۵`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={
                        i < t.rating
                          ? "size-4 fill-gold-400 text-gold-400"
                          : "size-4 text-[color:var(--line)]"
                      }
                    />
                  ))}
                </div>
                <blockquote className="flex-1 text-sm leading-8 text-[color:var(--fg-muted)]">
                  «{t.body}»
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-[color:var(--line)] pt-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-200 to-cream-200 font-bold text-plum-600 dark:from-rose-500/25 dark:to-plum-700 dark:text-rose-100">
                    {t.authorName.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t.authorName}</span>
                    {t.serviceName && (
                      <span className="block text-xs text-[color:var(--fg-muted)]">{t.serviceName}</span>
                    )}
                  </span>
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label="نظر قبلی"
          className="grid size-11 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <ChevronRight className="size-5" />
        </button>

        <div className="flex gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={`رفتن به نظر ${toFa(i + 1)}`}
              className={
                i === selected
                  ? "h-2 w-7 rounded-full bg-rose-500 transition-all"
                  : "size-2 rounded-full bg-[color:var(--line)] transition-all hover:bg-rose-300"
              }
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          aria-label="نظر بعدی"
          className="grid size-11 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)]"
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>
    </div>
  );
}
