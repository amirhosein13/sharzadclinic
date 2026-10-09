import Link from "next/link";
import { CircleDot, ClipboardList, Eye, EyeOff, Trash2, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { DutyForm } from "@/components/admin/forms/duty-form";
import { TaskForm } from "@/components/admin/forms/task-form";
import { deleteDuty, toggleDutyActive } from "@/app/actions/duties";
import { Badge } from "@/components/ui/badge";
import { REPEAT_LABELS, dayKey, todayProgress } from "@/lib/duties";
import { WEEKDAYS_FA, formatJalaliWithWeekday } from "@/lib/date";
import { ROLE_LABELS } from "@/lib/permissions";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * «مسئولیت‌ها» — جایی که مدیر یک‌بار می‌گوید چه کسی چه کاری دارد.
 *
 * دو نیمه دارد و ترتیبشان عمدی است: اول «امروز چه خبر است» (چیزی که
 * مدیر هر روز می‌خواهد ببیند)، بعد فهرست تعریف‌ها (چیزی که ماهی
 * یک‌بار عوض می‌شود).
 */
export default async function DutiesPage() {
  await guardPage("duties");
  const today = dayKey();

  // progress خودش کارهای امروزِ همه را می‌سازد، پس باید قبل از
  // خواندن فهرست کاربران صدا زده شود
  const progress = await todayProgress(today);

  const [users, duties] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true, staff: { select: { name: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.duty.findMany({
      include: { assignee: { select: { name: true, role: true } } },
      orderBy: [{ isActive: "desc" }, { order: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const options = users.map((u) => ({
    id: u.id,
    name: u.name,
    roleLabel: ROLE_LABELS[u.role],
  }));

  return (
    <>
      <AdminPageHeader
        title="مسئولیت‌ها"
        description="یک‌بار تعریف کنید چه کسی چه کاری دارد؛ هر روز خودکار در فهرست کارهای او می‌آید."
        action={
          <div className="flex flex-wrap gap-2">
            <TaskForm users={options} />
            <DutyForm users={options} />
          </div>
        }
      />

      {/* ── امروز هر کس کجاست ── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">
          امروز{" "}
          <span className="text-sm font-normal text-[color:var(--fg-muted)]">
            {formatJalaliWithWeekday(today)}
          </span>
        </h2>

        {users.length === 0 ? (
          <Card>
            <p className="text-sm leading-7 text-[color:var(--fg-muted)]">
              هیچ حساب کاربری فعالی نیست. اول از بخش{" "}
              <Link href="/admin/users" className="font-medium text-[color:var(--fg)] underline">
                کاربران پنل
              </Link>{" "}
              برای پرسنل حساب بسازید.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => {
              const stat = progress.get(user.id) ?? { done: 0, open: 0, overdue: 0 };
              const total = stat.done + stat.open;
              const percent = total === 0 ? 0 : Math.round((stat.done / total) * 100);

              return (
                <Card key={user.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{user.name}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--fg-muted)]">
                        {ROLE_LABELS[user.role]}
                      </p>
                    </div>
                    {total > 0 && (
                      <span className="shrink-0 text-sm font-extrabold tabular-nums">
                        {toFa(percent)}٪
                      </span>
                    )}
                  </div>

                  {total === 0 ? (
                    <p className="mt-4 text-xs text-[color:var(--fg-subtle)]">
                      امروز کاری برایش تعریف نشده.
                    </p>
                  ) : (
                    <>
                      <div
                        className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--bg-sunken)]"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-[width]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="mt-2.5 text-xs text-[color:var(--fg-muted)]">
                        {toFa(stat.done)} از {toFa(total)} کار انجام شده
                      </p>
                    </>
                  )}

                  {stat.overdue > 0 && (
                    <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                      ⚠️ {toFa(stat.overdue)} کار از روزهای قبل مانده
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── تعریف‌ها ── */}
      <section>
        <h2 className="mb-3 text-lg font-bold">کارهای تکرارشونده ({toFa(duties.length)})</h2>

        {duties.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="هنوز مسئولیتی تعریف نشده"
            description="مثلاً: «آخر وقت صندوق را ببند» برای منشی، هر روز."
          />
        ) : (
          <div className="space-y-3">
            {duties.map((duty) => (
              <Card key={duty.id} className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{duty.title}</p>
                    {!duty.isActive && <Badge tone="neutral">متوقف</Badge>}
                  </div>

                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--fg-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {duty.assignee.name}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CircleDot className="size-3.5" />
                      {describeRepeat(duty)}
                    </span>
                    {duty.timeHint && <span>{duty.timeHint}</span>}
                  </p>

                  {duty.note && (
                    <p className="mt-2.5 rounded-xl bg-[color:var(--bg-sunken)] p-2.5 text-xs leading-6">
                      {duty.note}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <DutyForm
                    users={options}
                    duty={{
                      id: duty.id,
                      title: duty.title,
                      note: duty.note,
                      assigneeId: duty.assigneeId,
                      repeat: duty.repeat,
                      weekdays: duty.weekdays,
                      monthDay: duty.monthDay,
                      timeHint: duty.timeHint,
                      isActive: duty.isActive,
                    }}
                  />
                  <ActionButton action={toggleDutyActive.bind(null, duty.id)}>
                    {duty.isActive ? (
                      <>
                        <EyeOff className="size-3.5" /> توقف
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" /> فعال
                      </>
                    )}
                  </ActionButton>
                  <ActionButton
                    action={deleteDuty.bind(null, duty.id)}
                    confirm={`«${duty.title}» حذف شود؟ سابقه‌ی تیک‌های این کار هم پاک می‌شود. اگر فقط می‌خواهید موقتاً متوقف شود، از «توقف» استفاده کنید.`}
                    title="حذف مسئولیت"
                    className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** «هفتگی: شنبه، سه‌شنبه» — تا مدیر بی‌آنکه بازش کند بفهمد */
function describeRepeat(duty: {
  repeat: "DAILY" | "WEEKLY" | "MONTHLY";
  weekdays: number[];
  monthDay: number | null;
}): string {
  if (duty.repeat === "WEEKLY") {
    const names = [...duty.weekdays].sort((a, b) => a - b).map((d) => WEEKDAYS_FA[d]);
    return names.length ? names.join("، ") : "هفتگی — روزی انتخاب نشده";
  }
  if (duty.repeat === "MONTHLY") {
    return duty.monthDay ? `روز ${toFa(duty.monthDay)} هر ماه` : "ماهانه — روزی انتخاب نشده";
  }
  return REPEAT_LABELS[duty.repeat];
}
