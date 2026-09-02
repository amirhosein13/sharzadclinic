"use client";

import { useState } from "react";
import { Modal } from "@/components/admin/modal";

type Shot = { url: string; label: string };

/**
 * نمایش عکس قبل/بعد پرونده. آدرس این فایل‌ها پشت لایه‌ی دسترسی است،
 * پس بهینه‌ساز تصویر Next به آن نمی‌رسد و از img ساده استفاده می‌کنیم.
 */
export function CasePhotos({
  before,
  after,
  caption,
}: {
  before?: string | null;
  after?: string | null;
  caption: string;
}) {
  const [zoom, setZoom] = useState<Shot | null>(null);
  const shots: Shot[] = [];
  if (before) shots.push({ url: before, label: "قبل" });
  if (after) shots.push({ url: after, label: "بعد" });
  if (shots.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-3">
        {shots.map((shot) => (
          <button
            key={shot.url}
            type="button"
            onClick={() => setZoom(shot)}
            className="group relative size-24 overflow-hidden rounded-xl border border-[color:var(--line)] transition-transform hover:scale-[1.03]"
            aria-label={`بزرگ‌نمایی عکس ${shot.label}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.url} alt={shot.label} className="size-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-plum-900/65 py-1 text-center text-[11px] font-medium text-white">
              {shot.label}
            </span>
          </button>
        ))}
      </div>

      <Modal
        open={!!zoom}
        onClose={() => setZoom(null)}
        title={zoom ? `عکس ${zoom.label}` : ""}
        description={caption}
        wide
      >
        {zoom && (
          <div className="p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoom.url}
              alt={zoom.label}
              className="mx-auto max-h-[70vh] w-auto rounded-2xl object-contain"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
