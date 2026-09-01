"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm " +
  "transition-colors placeholder:text-[color:var(--fg-muted)] " +
  "focus:border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-500/10 disabled:opacity-60";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-sm font-medium", className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "min-h-28 resize-y leading-7", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "cursor-pointer appearance-none bg-left bg-no-repeat pl-10", className)} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{children}</p>;
}

export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="mr-1 text-rose-500">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-[color:var(--fg-muted)]">{hint}</p>}
      <FieldError>{error}</FieldError>
    </div>
  );
}
