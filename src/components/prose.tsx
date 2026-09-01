import { cn } from "@/lib/utils";

/**
 * رندر متن‌های بلند (توضیح خدمات و مقالات).
 * فرمت پشتیبانی‌شده: پاراگراف با خط خالی، «## عنوان»، «- آیتم» و **پررنگ**.
 */
export function Prose({ children, className }: { children: string; className?: string }) {
  const blocks = children.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className={cn("space-y-5", className)}>
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-4 text-xl font-bold sm:text-2xl">
              {block.slice(3)}
            </h2>
          );
        }
        if (block.startsWith("### ")) {
          return (
            <h3 key={i} className="pt-2 text-lg font-bold">
              {block.slice(4)}
            </h3>
          );
        }

        const lines = block.split("\n");
        if (lines.every((l) => /^[-*•]\s/.test(l.trim()))) {
          return (
            <ul key={i} className="space-y-2.5 pr-1">
              {lines.map((line, j) => (
                <li key={j} className="flex gap-3 text-[15px] leading-8 text-[color:var(--fg-muted)]">
                  <span className="mt-3 size-1.5 shrink-0 rounded-full bg-rose-400" />
                  <span>{inline(line.trim().replace(/^[-*•]\s/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+[.)]\s/.test(l.trim()))) {
          return (
            <ol key={i} className="space-y-2.5 pr-1">
              {lines.map((line, j) => (
                <li key={j} className="flex gap-3 text-[15px] leading-8 text-[color:var(--fg-muted)]">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                    {j + 1}
                  </span>
                  <span>{inline(line.trim().replace(/^\d+[.)]\s/, ""))}</span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={i} className="text-[15px] leading-9 text-[color:var(--fg-muted)]">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

/** پشتیبانی از **پررنگ** داخل خط */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-[color:var(--fg)]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
