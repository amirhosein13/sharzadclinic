"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, Phone, RotateCcw, Send } from "lucide-react";
import { replyAsStaff, setTicketStatus } from "@/app/actions/tickets";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn, toFa } from "@/lib/utils";

export type StaffTicketView = {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  subject: string;
  categoryLabel: string;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  statusLabel: string;
  statusTone: "amber" | "green" | "neutral";
  isUrgent: boolean;
  unread: boolean;
  updatedLabel: string;
  messages: {
    id: string;
    fromClinic: boolean;
    body: string;
    timeLabel: string;
    authorName: string | null;
  }[];
};

export function TicketThread({ ticket, defaultOpen }: { ticket: StaffTicketView; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => () =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });

  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl border bg-[color:var(--bg-elevated)] shadow-soft",
        ticket.isUrgent
          ? "border-red-300 dark:border-red-400/30"
          : ticket.unread
            ? "border-rose-300 dark:border-rose-400/30"
            : "border-[color:var(--line)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-right"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{ticket.subject}</span>
            <Badge tone={ticket.statusTone}>{ticket.statusLabel}</Badge>
            {ticket.isUrgent && <Badge tone="red">شکایت</Badge>}
            {ticket.unread && <Badge tone="rose">خوانده‌نشده</Badge>}
          </span>
          <span className="mt-1 block text-xs text-[color:var(--fg-muted)]">
            {ticket.customerName} • {ticket.categoryLabel} • {ticket.updatedLabel} •{" "}
            {toFa(ticket.messages.length)} پیام
          </span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-[color:var(--line)] p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/customers/${ticket.customerId}`}
              className="rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
            >
              پرونده‌ی مشتری
            </Link>
            <a
              href={`tel:${ticket.phone}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
              dir="ltr"
            >
              <Phone className="size-3.5" />
              {toFa(ticket.phone)}
            </a>
            {ticket.status === "CLOSED" ? (
              <button
                type="button"
                disabled={pending}
                onClick={run(() => setTicketStatus(ticket.id, "OPEN"))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" />
                باز کردن دوباره
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={run(() => setTicketStatus(ticket.id, "CLOSED"))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)] disabled:opacity-50"
              >
                <Check className="size-3.5" />
                بستن بدون پاسخ
              </button>
            )}
            {pending && <Loader2 className="size-4 animate-spin text-rose-500" />}
          </div>

          <ol className="space-y-3">
            {ticket.messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-2xl p-4 text-sm leading-8",
                  m.fromClinic
                    ? "mr-auto bg-rose-50 dark:bg-rose-500/10"
                    : "bg-[color:var(--bg-sunken)]",
                )}
              >
                <p className="mb-1.5 text-[11px] font-medium text-[color:var(--fg-muted)]">
                  {m.fromClinic ? m.authorName ?? "کلینیک" : ticket.customerName} • {m.timeLabel}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ol>

          {ticket.status !== "CLOSED" && (
            <form
              action={(formData) =>
                startTransition(async () => {
                  const result = await replyAsStaff(formData);
                  if (result.ok) {
                    toast.success(result.message);
                    setErrors({});
                  } else {
                    setErrors(result.errors ?? {});
                    toast.error(result.message);
                  }
                })
              }
              className="mt-5 space-y-3 border-t border-[color:var(--line)] pt-5"
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Textarea name="body" rows={4} placeholder="پاسخ شما به مشتری..." />
              {errors.body && <p className="text-xs text-red-600 dark:text-red-400">{errors.body}</p>}

              <label className="flex cursor-pointer items-center gap-2.5 text-xs">
                <input type="checkbox" name="closeAfter" className="size-4 accent-rose-500" />
                پس از ارسال، گفت‌وگو بسته شود
              </label>

              <Button type="submit" size="sm" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                ارسال پاسخ
              </Button>
              <p className="text-xs text-[color:var(--fg-muted)]">
                با ارسال پاسخ، یک پیامک هم برای مشتری می‌رود که بیاید ببیند.
              </p>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
