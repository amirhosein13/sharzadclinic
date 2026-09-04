import Link from "next/link";
import { History, Search } from "lucide-react";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { AUDIT_GROUPS, auditActors, listAudit, type AuditGroupKey } from "@/lib/audit";
import { formatJalaliDateTime, timeAgoFa } from "@/lib/date";
import { toFa } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES = [
  { days: 1, label: "۲۴ ساعت" },
  { days: 7, label: "۷ روز" },
  { days: 30, label: "۳۰ روز" },
  { days: 0, label: "همه" },
];

const GROUP_KEYS = new Set<string>([...AUDIT_GROUPS.map((g) => g.key), "other"]);

type Params = {
  group?: string;
  user?: string;
  q?: string;
  days?: string;
  page?: string;
};

/** لینک فیلتر، با حفظ بقیه‌ی فیلترها */
function withParams(current: Params, patch: Params): string {
  const next = { ...current, ...patch };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value && value !== "") query.set(key, String(value));
  }
  const s = query.toString();
  return s ? `/admin/audit?${s}` : "/admin/audit";
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl px-3.5 py-2 text-xs font-medium transition-colors",
        active
          ? "bg-rose-500 text-white"
          : "border border-[color:var(--line)] hover:bg-[color:var(--bg-sunken)]",
      )}
    >
      {children}
    </Link>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await guardPage("audit");
  const params = await searchParams;

  const group = GROUP_KEYS.has(params.group ?? "")
    ? (params.group as AuditGroupKey)
    : undefined;
  const days = params.days !== undefined ? Number(params.days) : 7;
  const page = Number(params.page) || 1;

  const [result, actors] = await Promise.all([
    listAudit({ group, userId: params.user, q: params.q, days, page }),
    auditActors(),
  ]);

  // فیلترها بدون شماره‌ی صفحه، تا با عوض‌شدن فیلتر به صفحه‌ی یک برگردیم
  const base: Params = { ...params, page: undefined };

  return (
    <>
      <AdminPageHeader
        title="گزارش فعالیت"
        description="چه کسی چه کاری کرد. برای وقتی چیزی عوض شده یا حذف شده و می‌خواهید بدانید کارِ که بوده."
      />

      <Card className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Chip href={withParams(base, { group: undefined })} active={!group}>
            همه
          </Chip>
          {AUDIT_GROUPS.map((g) => (
            <Chip key={g.key} href={withParams(base, { group: g.key })} active={group === g.key}>
              {g.label}
            </Chip>
          ))}
          <Chip href={withParams(base, { group: "other" })} active={group === "other"}>
            سایر
          </Chip>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--line)] pt-4">
          <span className="text-xs text-[color:var(--fg-muted)]">بازه:</span>
          {RANGES.map((r) => (
            <Chip
              key={r.days}
              href={withParams(base, { days: String(r.days) })}
              active={days === r.days}
            >
              {r.label}
            </Chip>
          ))}
        </div>

        {actors.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--line)] pt-4">
            <span className="text-xs text-[color:var(--fg-muted)]">کاربر:</span>
            <Chip href={withParams(base, { user: undefined })} active={!params.user}>
              همه
            </Chip>
            {actors.map((a) => (
              <Chip
                key={a.id}
                href={withParams(base, { user: a.id })}
                active={params.user === a.id}
              >
                {a.name}
              </Chip>
            ))}
          </div>
        )}

        <form className="flex gap-2 border-t border-[color:var(--line)] pt-4">
          {group && <input type="hidden" name="group" value={group} />}
          {params.user && <input type="hidden" name="user" value={params.user} />}
          <input type="hidden" name="days" value={String(days)} />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="جستجو در جزئیات — مثلاً یک ایمیل یا نام"
            className="w-full rounded-2xl border border-[color:var(--line)] bg-transparent px-4 py-2.5 text-sm outline-none focus:border-rose-400"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-600"
          >
            <Search className="size-4" />
            جستجو
          </button>
        </form>
      </Card>

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="در این بازه فعالیتی ثبت نشده"
            description="بازه‌ی بلندتری انتخاب کنید یا فیلترها را بردارید."
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-[color:var(--fg-muted)]">
            {toFa(result.total)} رویداد — صفحه‌ی {toFa(result.page)} از {toFa(result.pages)}
          </p>

          <Card padded={false}>
            <ul className="divide-y divide-[color:var(--line)]">
              {result.rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start gap-3 p-4">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      row.tone === "red"
                        ? "bg-red-500"
                        : row.tone === "amber"
                          ? "bg-amber-500"
                          : "bg-[color:var(--line)]",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.description}</p>
                    {row.detail && (
                      <p className="mt-1 truncate text-xs text-[color:var(--fg-muted)]" dir="auto">
                        {row.detail}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-xs font-medium">{row.who}</p>
                    <p
                      className="mt-1 text-[11px] text-[color:var(--fg-muted)]"
                      title={formatJalaliDateTime(row.createdAt)}
                    >
                      {timeAgoFa(row.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {result.pages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-2">
              {result.page > 1 && (
                <Chip href={withParams(params, { page: String(result.page - 1) })} active={false}>
                  صفحه‌ی قبل
                </Chip>
              )}
              {result.page < result.pages && (
                <Chip href={withParams(params, { page: String(result.page + 1) })} active={false}>
                  صفحه‌ی بعد
                </Chip>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
