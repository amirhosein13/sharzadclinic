"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DatabaseBackup, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ساخت پشتیبان ممکن است چند دقیقه طول بکشد، پس به‌جای یک لینک ساده،
 * وضعیت «در حال آماده‌سازی» را نشان می‌دهیم تا مدیر فکر نکند کار نکرد.
 */
export function BackupButton({ withoutFiles = false }: { withoutFiles?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const toastId = toast.loading("در حال آماده‌سازی نسخه‌ی پشتیبان... چند لحظه صبر کنید.");
    try {
      const res = await fetch(`/api/backup${withoutFiles ? "?files=0" : ""}`);
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "sharzad-backup.zip";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success("نسخه‌ی پشتیبان دانلود شد. جای امنی نگهش دارید.", { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : "ساخت پشتیبان انجام نشد.",
        { id: toastId },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" onClick={run} disabled={busy} variant={withoutFiles ? "outline" : undefined}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
      {busy ? "در حال آماده‌سازی..." : withoutFiles ? "فقط اطلاعات (سبک)" : "گرفتن پشتیبان کامل"}
    </Button>
  );
}
