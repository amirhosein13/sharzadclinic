"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleCheck, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { addPackagePayment, deletePackage } from "@/app/actions/packages";
import { PackageForm, type PackageFormValues } from "./forms/package-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { formatJalaliLong } from "@/lib/date";
import { cn, formatToman, toEn, toFa } from "@/lib/utils";

export type PackageView = {
  id: string;
  title: string;
  serviceTitle: string;
  serviceId: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  price: number;
  paidAmount: number;
  remainingAmount: number;
  purchasedAt: string;
  expiresAt: string | null;
  expiresAtJalali: string | null;
  isExpired: boolean;
  isFinished: boolean;
  note: string | null;
};

export function PackageCard({
  pkg,
  customerId,
  customerName,
  services,
  canEdit,
}: {
  pkg: PackageView;
  customerId: string;
  customerName: string;
  services: { id: string; title: string }[];
  canEdit: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const progress = pkg.totalSessions > 0 ? (pkg.usedSessions / pkg.totalSessions) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-3xl border p-5",
        pkg.isExpired
          ? "border-red-300/60 bg-red-50/40 dark:border-red-400/25 dark:bg-red-500/5"
          : pkg.isFinished
            ? "border-[color:var(--line)] bg-[color:var(--bg-sunken)]"
            : "border-gold-500/40 bg-gold-500/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{pkg.title}</h3>
            {pkg.isExpired && <Badge tone="red">منقضی شده</Badge>}
            {pkg.isFinished && !pkg.isExpired && <Badge tone="neutral">تمام شد</Badge>}
            {!pkg.isFinished && !pkg.isExpired && <Badge tone="gold">فعال</Badge>}
          </div>
          <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
            خرید {formatJalaliLong(new Date(pkg.purchasedAt))}
            {pkg.expiresAtJalali && ` • انقضا ${pkg.expiresAtJalali}`}
          </p>
        </div>

        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <PackageForm
              customerId={customerId}
              customerName={customerName}
              services={services}
              pkg={
                {
                  id: pkg.id,
                  serviceId: pkg.serviceId,
                  title: pkg.title,
                  totalSessions: pkg.totalSessions,
                  price: pkg.price,
                  paidAmount: pkg.paidAmount,
                  expiresAt: pkg.expiresAtJalali,
                  note: pkg.note,
                } satisfies PackageFormValues
              }
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`پکیج «${pkg.title}» حذف شود؟`)) return;
                startTransition(async () => {
                  const r = await deletePackage(pkg.id);
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                });
              }}
              aria-label="حذف پکیج"
              className="grid size-8 place-items-center rounded-lg border border-[color:var(--line)] text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* پیشرفت جلسات */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium">
            {toFa(pkg.usedSessions)} از {toFa(pkg.totalSessions)} جلسه انجام شده
          </span>
          <span
            className={cn(
              "font-bold",
              pkg.remainingSessions > 0 ? "text-gold-600 dark:text-gold-300" : "text-[color:var(--fg-muted)]"
            )}
          >
            {pkg.remainingSessions > 0 ? `${toFa(pkg.remainingSessions)} جلسه باقی` : "تمام شد"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--line)]">
          <div
            className="h-full rounded-full bg-gradient-to-l from-gold-500 to-rose-400 transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      {/* مالی */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--line)] pt-4 text-center">
        <div>
          <p className="text-[11px] text-[color:var(--fg-muted)]">قیمت کل</p>
          <p className="mt-0.5 text-xs font-bold">{formatToman(pkg.price, false)}</p>
        </div>
        <div>
          <p className="text-[11px] text-[color:var(--fg-muted)]">دریافت‌شده</p>
          <p className="mt-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-300">
            {formatToman(pkg.paidAmount, false)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[color:var(--fg-muted)]">باقی‌مانده</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-bold",
              pkg.remainingAmount > 0 ? "text-red-600 dark:text-red-300" : ""
            )}
          >
            {formatToman(pkg.remainingAmount, false)}
          </p>
        </div>
      </div>

      {pkg.note && (
        <p className="mt-3 rounded-xl bg-[color:var(--bg-elevated)] p-2.5 text-xs leading-6">
          {pkg.note}
        </p>
      )}

      {/* ثبت قسط */}
      {canEdit && pkg.remainingAmount > 0 && (
        <div className="mt-4 flex gap-2 border-t border-[color:var(--line)] pt-4">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`مبلغ دریافتی (باقی: ${formatToman(pkg.remainingAmount, false)})`}
            inputMode="numeric"
            dir="ltr"
            className="text-right text-xs"
          />
          <button
            type="button"
            disabled={pending || !amount.trim()}
            onClick={() => {
              const value = Number(toEn(amount));
              if (!Number.isFinite(value) || value <= 0) {
                toast.error("مبلغ معتبر وارد کنید.");
                return;
              }
              startTransition(async () => {
                const r = await addPackagePayment(pkg.id, Math.round(value));
                if (r.ok) {
                  toast.success(r.message);
                  setAmount("");
                } else toast.error(r.message);
              });
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            ثبت قسط
          </button>
        </div>
      )}

      {pkg.isExpired && pkg.remainingSessions > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
          <TriangleAlert className="size-3.5 shrink-0" />
          {toFa(pkg.remainingSessions)} جلسه استفاده‌نشده باقی مانده بود.
        </p>
      )}
      {pkg.isFinished && !pkg.isExpired && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[color:var(--fg-muted)]">
          <CircleCheck className="size-3.5 shrink-0" />
          همه‌ی جلسات این دوره انجام شده.
        </p>
      )}
    </div>
  );
}
