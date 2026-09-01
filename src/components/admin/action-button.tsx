"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

/**
 * دکمه‌ای که یک Server Action را صدا می‌زند و نتیجه را به‌صورت toast نشان می‌دهد.
 */
export function ActionButton({
  action,
  children,
  confirm,
  className,
  title,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-50",
        className
      )}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : children}
    </button>
  );
}
