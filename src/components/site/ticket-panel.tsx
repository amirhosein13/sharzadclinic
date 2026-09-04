"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, MessageSquarePlus, Send } from "lucide-react";
import { openTicket, replyAsCustomer } from "@/app/actions/tickets";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, toFa } from "@/lib/utils";

export type TicketView = {
  id: string;
  subject: string;
  categoryLabel: string;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  statusLabel: string;
  statusTone: "amber" | "green" | "neutral";
  hasUnread: boolean;
  updatedLabel: string;
  messages: {
    id: string;
    fromClinic: boolean;
    body: string;
    timeLabel: string;
    authorName: string | null;
  }[];
};

export function TicketPanel({
  tickets,
  categories,
}: {
  tickets: TicketView[];
  categories: { key: string; label: string }[];
}) {
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(
    tickets.find((t) => t.hasUnread)?.id ?? null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(action: (fd: FormData) => Promise<{ ok: boolean; message: string; errors?: Record<string, string> }>, onDone?: () => void) {
    return (formData: FormData) =>
      startTransition(async () => {
        const result = await action(formData);
        if (result.ok) {
          toast.success(result.message);
          setErrors({});
          onDone?.();
        } else {
          setErrors(result.errors ?? {});
          toast.error(result.message);
        }
      });
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">گفت‌وگو با کلینیک</h2>
        {!composing && (
          <Button size="sm" variant="outline" onClick={() => setComposing(true)}>
            <MessageSquarePlus className="size-4" />
            پیام جدید
          </Button>
        )}
      </div>

      {composing && (
        <form
          action={submit(openTicket, () => setComposing(false))}
          className="mb-5 space-y-4 rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 shadow-soft"
        >
          <Field label="موضوع" required error={errors.subject}>
            <Input name="subject" placeholder="مثلاً: سؤال درباره‌ی مراقبت بعد از لیزر" autoFocus />
          </Field>

          <Field label="دسته" required error={errors.category}>
            <Select name="category" defaultValue="other">
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="پیام شما" required error={errors.body}>
            <Textarea name="body" rows={5} placeholder="هر چه لازم است بنویسید..." />
          </Field>

          <div className="flex gap-3">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {pending ? "در حال ارسال..." : "ارسال پیام"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setComposing(false)} disabled={pending}>
              انصراف
            </Button>
          </div>
        </form>
      )}

      {tickets.length === 0 ? (
        !composing && (
          <p className="rounded-3xl border border-dashed border-[color:var(--line)] p-8 text-center text-sm leading-8 text-[color:var(--fg-muted)]">
            هر سؤالی درباره‌ی درمان، نوبت یا پرداختتان دارید همین‌جا بنویسید.
            <br />
            پاسخ را هم این‌جا می‌بینید و هم برایتان پیامک می‌شود.
          </p>
        )
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const isOpen = openId === ticket.id;
            return (
              <li
                key={ticket.id}
                className={cn(
                  "overflow-hidden rounded-3xl border bg-[color:var(--bg-elevated)] shadow-soft transition-colors",
                  ticket.hasUnread
                    ? "border-rose-300 dark:border-rose-400/30"
                    : "border-[color:var(--line)]",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : ticket.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 p-5 text-right"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{ticket.subject}</span>
                      <Badge tone={ticket.statusTone}>{ticket.statusLabel}</Badge>
                      {ticket.hasUnread && <Badge tone="rose">پاسخ تازه</Badge>}
                    </span>
                    <span className="mt-1 block text-xs text-[color:var(--fg-muted)]">
                      {ticket.categoryLabel} • {ticket.updatedLabel} •{" "}
                      {toFa(ticket.messages.length)} پیام
                    </span>
                  </span>
                  <ChevronDown
                    className={cn("size-5 shrink-0 transition-transform", isOpen && "rotate-180")}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[color:var(--line)] p-5">
                    <ol className="space-y-3">
                      {ticket.messages.map((m) => (
                        <li
                          key={m.id}
                          className={cn(
                            "max-w-[85%] rounded-2xl p-4 text-sm leading-8",
                            m.fromClinic
                              ? "bg-[color:var(--bg-sunken)]"
                              : "mr-auto bg-rose-50 dark:bg-rose-500/10",
                          )}
                        >
                          <p className="mb-1.5 text-[11px] font-medium text-[color:var(--fg-muted)]">
                            {m.fromClinic ? m.authorName ?? "کلینیک" : "شما"} • {m.timeLabel}
                          </p>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                        </li>
                      ))}
                    </ol>

                    {ticket.status === "CLOSED" ? (
                      <p className="mt-4 rounded-2xl bg-[color:var(--bg-sunken)] p-4 text-center text-xs text-[color:var(--fg-muted)]">
                        این گفت‌وگو بسته شده است. اگر باز هم سؤالی دارید، پیام تازه‌ای باز کنید.
                      </p>
                    ) : (
                      <form action={submit(replyAsCustomer)} className="mt-4 space-y-3">
                        <input type="hidden" name="ticketId" value={ticket.id} />
                        <Textarea name="body" rows={3} placeholder="پاسخ شما..." />
                        <Button type="submit" size="sm" disabled={pending}>
                          {pending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                          ارسال
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
