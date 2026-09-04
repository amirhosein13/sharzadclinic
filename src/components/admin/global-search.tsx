"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, MessagesSquare, Search, UserRound, X } from "lucide-react";
import { cn, toFa } from "@/lib/utils";

type Hit = {
  kind: "customer" | "appointment" | "ticket";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const ICONS = {
  customer: UserRound,
  appointment: CalendarDays,
  ticket: MessagesSquare,
} as const;

const KIND_LABELS = {
  customer: "مشتری",
  appointment: "نوبت",
  ticket: "گفت‌وگو",
} as const;

/**
 * جستجوی سراسری پنل. با Ctrl+K یا کلیک باز می‌شود و مستقیم به پرونده‌ی
 * مشتری یا نوبت می‌برد — بدون اینکه منشی اول برود صفحه‌ی مشتریان.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K یا Cmd+K از هر جای پنل
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  // با هر تایپ، کمی صبر می‌کنیم تا سرور بی‌خود شخم زده نشود
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!cancelled) {
          setHits(data.hits ?? []);
          setActive(0);
        }
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function go(hit: Hit) {
    setOpen(false);
    router.push(hit.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-[color:var(--line)] px-4 py-2.5 text-sm text-[color:var(--fg-muted)] transition-colors hover:bg-[color:var(--bg-sunken)]"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-right">جستجوی مشتری، نوبت یا گفت‌وگو...</span>
        <kbd className="hidden shrink-0 rounded-md border border-[color:var(--line)] px-1.5 py-0.5 text-[10px] sm:block" dir="ltr">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[10vh]">
          <div className="fixed inset-0 bg-plum-900/55 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="جستجو"
            className="relative w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-4">
              <Search className="size-5 shrink-0 text-[color:var(--fg-muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(i + 1, hits.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && hits[active]) {
                    e.preventDefault();
                    go(hits[active]);
                  }
                }}
                placeholder="نام، شماره موبایل، کد نوبت..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--fg-muted)]"
              />
              {loading && <Loader2 className="size-4 shrink-0 animate-spin text-rose-500" />}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن"
                className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-[color:var(--bg-sunken)]"
              >
                <X className="size-4" />
              </button>
            </div>

            {query.trim().length >= 2 && !loading && hits.length === 0 && (
              <p className="p-8 text-center text-sm text-[color:var(--fg-muted)]">
                چیزی پیدا نشد.
              </p>
            )}

            {query.trim().length < 2 && (
              <p className="p-8 text-center text-sm leading-7 text-[color:var(--fg-muted)]">
                حداقل دو حرف بنویسید.
                <br />
                می‌توانید شماره موبایل یا کد پیگیری نوبت را هم وارد کنید.
              </p>
            )}

            {hits.length > 0 && (
              <ul className="max-h-[55vh] overflow-y-auto p-2">
                {hits.map((hit, index) => {
                  const Icon = ICONS[hit.kind];
                  return (
                    <li key={`${hit.kind}-${hit.id}`}>
                      <button
                        type="button"
                        onClick={() => go(hit)}
                        onMouseEnter={() => setActive(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl p-3 text-right transition-colors",
                          index === active && "bg-[color:var(--bg-sunken)]",
                        )}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color:var(--bg-sunken)]">
                          <Icon className="size-4 text-rose-500" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{hit.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-[color:var(--fg-muted)]">
                            {toFa(hit.subtitle)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-[color:var(--fg-muted)]">
                          {KIND_LABELS[hit.kind]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
