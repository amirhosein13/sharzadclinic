import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-[color:var(--bg-sunken)] text-[color:var(--fg-muted)] border-[color:var(--line)]",
  rose: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-300/20",
  gold: "bg-gold-500/10 text-gold-600 border-gold-500/25 dark:text-gold-300",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-400/20",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-400/20",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-400/20",
  plum: "bg-plum-50 text-plum-500 border-plum-100 dark:bg-white/5 dark:text-plum-100 dark:border-white/10",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
