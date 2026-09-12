"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Check,
  Copy,
  Eraser,
  Eye,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Prose } from "@/components/prose";
import { articlePrompt, tidyRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * ویرایشگر متن‌های بلند سایت.
 *
 * عمداً کتابخانه‌ی جدیدی اضافه نشده. دلیلش فقط «سبک‌بودن» نیست:
 * نصب پکیج روی سرور این پروژه واقعاً سخت است و هر وابستگی تازه یعنی
 * یک npm install دیگر روی سروری که دسترسی‌اش به مخزن npm شکننده است.
 *
 * طراحی از روی یک فرض ساده: کسی که با این کار می‌کند «مارک‌داون»
 * نمی‌داند و قرار هم نیست یاد بگیرد. پس:
 *   - دکمه‌ها کار را انجام می‌دهند، نه اینکه یادش بدهند چه بنویسد
 *   - پیش‌نمایش با همان <Prose> رندر می‌شود که سایت استفاده می‌کند،
 *     پس هرچه اینجا می‌بیند دقیقاً همان است که منتشر می‌شود
 *   - «مرتب کن» متنِ کپی‌شده از هوش مصنوعی را به قالب سایت ترجمه
 *     می‌کند، تا ستاره و مربع خام روی سایت ظاهر نشود
 */

type Tool = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** متنی که دور انتخاب می‌پیچد */
  wrap?: string;
  /** پیشوندی که اول هر خطِ انتخاب‌شده می‌آید */
  prefix?: string;
  /** پیشوند شماره‌دار */
  numbered?: boolean;
};

const TOOLS: Tool[] = [
  { icon: Heading1, label: "عنوان بخش", prefix: "## " },
  { icon: Heading2, label: "عنوان فرعی", prefix: "### " },
  { icon: Bold, label: "پررنگ", wrap: "**" },
  { icon: List, label: "فهرست", prefix: "- " },
  { icon: ListOrdered, label: "فهرست شماره‌دار", numbered: true },
];

export function RichTextEditor({
  name,
  defaultValue = "",
  rows = 16,
  showPrompt = true,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  /** دکمه‌ی «متن را با هوش مصنوعی بنویس» فقط برای مقاله معنی دارد */
  showPrompt?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [copied, setCopied] = useState(false);
  const [tidied, setTidied] = useState(false);

  /** متن را عوض می‌کند و انتخاب را همان‌جا نگه می‌دارد */
  function replace(next: string, selStart: number, selEnd: number) {
    setValue(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function apply(tool: Tool) {
    const el = ref.current;
    if (!el) return;

    let start = el.selectionStart;
    let end = el.selectionEnd;

    // انتخاب کاربر معمولاً فاصله‌ی اضافه دارد (دابل‌کلیک روی یک کلمه
    // فاصله‌ی بعدش را هم می‌گیرد). علامت باید بچسبد به خودِ کلمه،
    // وگرنه «**یک **» در می‌آید.
    while (start < end && /\s/.test(value[start])) start++;
    while (end > start && /\s/.test(value[end - 1])) end--;

    const selected = value.slice(start, end);

    if (tool.wrap) {
      const mark = tool.wrap;
      // اگر از قبل پررنگ است، برش می‌داریم — دکمه باید دوحالته باشد
      const already =
        value.slice(start - mark.length, start) === mark &&
        value.slice(end, end + mark.length) === mark;

      if (already) {
        const next =
          value.slice(0, start - mark.length) + selected + value.slice(end + mark.length);
        replace(next, start - mark.length, end - mark.length);
        return;
      }

      const body = selected || "متن پررنگ";
      const next = value.slice(0, start) + mark + body + mark + value.slice(end);
      replace(next, start + mark.length, start + mark.length + body.length);
      return;
    }

    // پیشوند خطی: مرز خطِ کامل را پیدا می‌کنیم، نه فقط انتخاب کاربر
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndRaw = value.indexOf("\n", end);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
    const block = value.slice(lineStart, lineEnd) || "متن";

    const lines = block.split("\n");
    const stripped = lines.map((l) => l.replace(/^(#{2,3}\s|-\s|\d+\.\s)/, ""));

    // اگر همه‌ی خط‌ها از قبل همین قالب را دارند، برش می‌داریم
    const has = tool.numbered
      ? lines.every((l) => /^\d+\.\s/.test(l))
      : lines.every((l) => l.startsWith(tool.prefix!));

    const next = has
      ? stripped
      : stripped.map((l, i) => (tool.numbered ? `${i + 1}. ${l}` : `${tool.prefix}${l}`));

    const joined = next.join("\n");
    replace(
      value.slice(0, lineStart) + joined + value.slice(lineEnd),
      lineStart,
      lineStart + joined.length,
    );
  }

  function tidy() {
    const next = tidyRichText(value);
    setValue(next);
    setTidied(true);
    setTimeout(() => setTidied(false), 2000);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(articlePrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // مرورگرهای قدیمی یا بدون اجازه‌ی کلیپ‌بورد: متن را نشان می‌دهیم
      // تا دست‌کم دستی کپی شود
      window.prompt("این متن را کپی کن و به هوش مصنوعی بده:", articlePrompt());
    }
  }

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--line)]">
      {/* متن واقعی که با فرم ارسال می‌شود */}
      <input type="hidden" name={name} value={value} />

      <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--line)] bg-[color:var(--bg-sunken)] p-2">
        <div className="flex items-center gap-0.5 rounded-xl bg-[color:var(--bg)] p-0.5">
          <TabButton active={tab === "write"} onClick={() => setTab("write")} icon={Pencil}>
            نوشتن
          </TabButton>
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye}>
            پیش‌نمایش
          </TabButton>
        </div>

        {tab === "write" && (
          <>
            <span className="mx-1 h-5 w-px bg-[color:var(--line)]" />
            {TOOLS.map((tool) => (
              <button
                key={tool.label}
                type="button"
                title={tool.label}
                aria-label={tool.label}
                onClick={() => apply(tool)}
                className="grid size-9 place-items-center rounded-lg text-[color:var(--fg-muted)] transition-colors hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
              >
                <tool.icon className="size-4" />
              </button>
            ))}

            <span className="mx-1 h-5 w-px bg-[color:var(--line)]" />
            <button
              type="button"
              onClick={tidy}
              title="متن چسبانده‌شده را به قالب سایت تبدیل می‌کند"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[color:var(--fg-muted)] transition-colors hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
            >
              {tidied ? <Check className="size-3.5 text-emerald-600" /> : <Eraser className="size-3.5" />}
              {tidied ? "مرتب شد" : "مرتب کن"}
            </button>
          </>
        )}

        {showPrompt && (
          <button
            type="button"
            onClick={copyPrompt}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--bg)] px-2.5 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-600" />
                کپی شد
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-rose-500" />
                <Copy className="size-3.5" />
                کپی دستور هوش مصنوعی
              </>
            )}
          </button>
        )}
      </div>

      {tab === "write" ? (
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? "متن را اینجا بنویس یا از جای دیگر کپی کن..."}
          className="block w-full resize-y bg-[color:var(--bg)] px-4 py-3.5 text-[15px] leading-8 outline-none placeholder:text-[color:var(--fg-subtle)]"
        />
      ) : (
        <div className="min-h-40 bg-[color:var(--bg)] px-4 py-5">
          {value.trim() ? (
            <Prose>{value}</Prose>
          ) : (
            <p className="text-sm text-[color:var(--fg-subtle)]">
              هنوز چیزی نوشته نشده. برگرد به «نوشتن».
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--line)] bg-[color:var(--bg-sunken)] px-3 py-2 text-[11px] text-[color:var(--fg-subtle)]">
        <span>
          متن را انتخاب کن و روی دکمه‌ها بزن. «پیش‌نمایش» دقیقاً همان چیزی است که روی سایت دیده می‌شود.
        </span>
        <span>{words.toLocaleString("fa-IR")} کلمه</span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-[color:var(--bg-sunken)] text-[color:var(--fg)]"
          : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}
