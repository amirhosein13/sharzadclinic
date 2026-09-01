import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-rose-500 text-white shadow-[0_8px_24px_-8px_rgba(183,110,121,0.7)] hover:bg-rose-600 hover:shadow-[0_12px_32px_-8px_rgba(183,110,121,0.8)] active:scale-[0.98]",
  gold:
    "bg-gradient-to-l from-gold-500 to-gold-400 text-plum-700 shadow-[0_8px_24px_-8px_rgba(201,169,97,0.7)] hover:brightness-105 active:scale-[0.98]",
  secondary:
    "bg-plum-500 text-cream-50 hover:bg-plum-600 active:scale-[0.98] dark:bg-cream-100 dark:text-plum-700 dark:hover:bg-white",
  outline:
    "border border-rose-300/70 text-rose-600 hover:bg-rose-50 hover:border-rose-400 dark:text-rose-200 dark:border-rose-300/30 dark:hover:bg-white/5",
  ghost:
    "text-[color:var(--fg)] hover:bg-[color:var(--bg-sunken)]",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-6 text-sm gap-2 rounded-2xl",
  lg: "h-14 px-8 text-base gap-2.5 rounded-2xl",
};

const BASE =
  "inline-flex select-none items-center justify-center font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

export type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({ className, variant = "primary", size = "md", ...props }: ButtonLinkProps) {
  return <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}
