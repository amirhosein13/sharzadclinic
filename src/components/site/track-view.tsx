"use client";

import { useEffect, useRef } from "react";

/**
 * ثبت یک بازدید. هیچ کوکی و شناسه‌ای نمی‌گذارد.
 *
 * از `sendBeacon` استفاده می‌کند تا اگر کاربر همان لحظه صفحه را بست هم
 * ثبت شود و به‌هیچ‌وجه سرعت صفحه را کند نکند.
 */
export function TrackView({ kind, slug }: { kind: string; slug?: string }) {
  const sent = useRef(false);

  useEffect(() => {
    // در حالت توسعه، React دو بار افکت را اجرا می‌کند؛ نباید دو بار بشمارد
    if (sent.current) return;
    sent.current = true;

    const payload = JSON.stringify({ kind, slug });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
        return;
      }
    } catch {
      // می‌افتیم روی fetch
    }
    fetch("/api/track", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);
  }, [kind, slug]);

  return null;
}
