"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

/**
 * امضای انگشتی/موس روی صفحه. تصویر نهایی به شکل data URL در یک
 * input مخفی می‌نشیند تا با فرم‌های Server Action ارسال شود.
 */
export function SignaturePad({ name, label = "امضای مراجعه‌کننده" }: { name: string; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // بوم را با چگالی صفحه هماهنگ می‌کنیم تا خط، پله‌پله نشود
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#3b2c3a";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setValue(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setValue("");
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-300"
          >
            <Eraser className="size-3.5" />
            پاک کردن
          </button>
        )}
      </div>

      <input type="hidden" name={name} value={value} />

      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        className="h-36 w-full touch-none rounded-2xl border border-dashed border-[color:var(--line)] bg-white"
        aria-label={label}
      />
      <p className="mt-2 text-xs text-[color:var(--fg-muted)]">
        با انگشت یا موس داخل کادر امضا کنید. اگر امضا نشود، رضایت‌نامه با تأیید متن ثبت می‌شود.
      </p>
    </div>
  );
}
