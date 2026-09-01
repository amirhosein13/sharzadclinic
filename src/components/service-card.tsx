import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { formatDuration, formatPriceRange } from "@/lib/utils";

export type ServiceCardData = {
  slug: string;
  title: string;
  shortDescription: string | null;
  image: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  durationMinutes: number;
  category?: { title: string } | null;
};

export function ServiceCard({ service }: { service: ServiceCardData }) {
  return (
    <Link
      href={`/services/${service.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
    >
      <div className="relative aspect-[16/11] overflow-hidden">
        <Image
          src={service.image || "/images/services/consultation.svg"}
          alt={service.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-105"
        />
        {service.category && (
          <span className="absolute right-4 top-4 rounded-full bg-white/85 px-3 py-1 text-[11px] font-medium text-plum-600 backdrop-blur">
            {service.category.title}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-bold transition-colors group-hover:text-rose-500">{service.title}</h3>
        {service.shortDescription && (
          <p className="mt-2.5 line-clamp-2 flex-1 text-sm leading-7 text-[color:var(--fg-muted)]">
            {service.shortDescription}
          </p>
        )}

        <div className="mt-5 flex items-end justify-between border-t border-[color:var(--line)] pt-4">
          <div>
            <p className="text-[11px] text-[color:var(--fg-muted)]">شروع قیمت</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-300">
              {formatPriceRange(service.priceFrom, service.priceTo)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-[color:var(--fg-muted)]">
              <Clock className="size-3.5" />
              {formatDuration(service.durationMinutes)}
            </span>
            <span className="grid size-9 place-items-center rounded-full bg-rose-50 text-rose-500 transition-all group-hover:bg-rose-500 group-hover:text-white dark:bg-rose-500/10">
              <ArrowLeft className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
