"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";

/**
 * انتخاب تصویر با آپلود. مقدار نهایی در یک input مخفی می‌نشیند
 * تا با فرم‌های Server Action کار کند.
 */
export function ImagePicker({
  name,
  label,
  defaultValue,
  aspect = "aspect-[16/10]",
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  aspect?: string;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (data.ok) {
        setUrl(data.url);
        toast.success("تصویر آپلود شد.");
      } else {
        toast.error(data.message ?? "آپلود ناموفق بود.");
      }
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input type="hidden" name={name} value={url} />

      <div
        className={`relative overflow-hidden rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--bg-sunken)] ${aspect}`}
      >
        {url ? (
          <>
            <Image src={url} alt="" fill sizes="400px" className="object-cover" />
            <button
              type="button"
              onClick={() => setUrl("")}
              aria-label="حذف تصویر"
              className="absolute left-2 top-2 grid size-8 place-items-center rounded-full bg-plum-900/70 text-white transition-colors hover:bg-red-600"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid h-full w-full place-items-center text-[color:var(--fg-muted)] transition-colors hover:text-rose-500"
          >
            {uploading ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <span className="flex flex-col items-center gap-2">
                <ImagePlus className="size-7" />
                <span className="text-xs">انتخاب تصویر</span>
              </span>
            )}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-[color:var(--fg-muted)]">
          {hint ?? "JPG، PNG، WebP یا SVG — حداکثر ۵ مگابایت"}
        </p>
        {url && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 text-xs font-medium text-rose-600 hover:underline dark:text-rose-300"
          >
            {uploading ? "در حال آپلود..." : "تغییر تصویر"}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
