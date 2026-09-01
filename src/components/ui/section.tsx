import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-right", className)}>
      {eyebrow && (
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/8 px-4 py-1.5 text-xs font-medium tracking-wide text-gold-600 dark:text-gold-300">
          {eyebrow}
        </span>
      )}
      <h2 className={cn("text-3xl font-bold leading-tight sm:text-4xl", align === "center" && "rule-ornament")}>
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-base leading-8 text-[color:var(--fg-muted)]">{description}</p>
      )}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-20 sm:py-28", className)}>
      <div className="container-page">{children}</div>
    </section>
  );
}
