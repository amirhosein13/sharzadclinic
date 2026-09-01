export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 text-sm leading-7 text-[color:var(--fg-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-soft ${
        padded ? "p-6" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[color:var(--line)] p-14 text-center">
      <Icon className="mx-auto size-10 text-rose-300" />
      <p className="mt-4 font-semibold">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-[color:var(--fg-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}
