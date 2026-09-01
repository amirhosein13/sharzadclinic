import Image from "next/image";
import { CalendarOff, Eye, EyeOff, Trash2, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { StaffForm } from "@/components/admin/forms/staff-form";
import { TimeOffForm } from "@/components/admin/forms/timeoff-form";
import { ScheduleForm } from "@/components/admin/forms/schedule-form";
import { toggleStaffActive } from "@/app/actions/admin";
import { deleteStaff } from "@/app/actions/content";
import { deleteTimeOff } from "@/app/actions/reception";
import { Badge } from "@/components/ui/badge";
import { WEEKDAYS_FA, formatJalaliLong, formatTime } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const user = await guardPage("staff");
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";

  const [staff, services, timeOffs] = await Promise.all([
    prisma.staff.findMany({
      include: {
        services: { include: { service: { select: { id: true, title: true } } } },
        schedules: { where: { isActive: true }, orderBy: { weekday: "asc" } },
        _count: { select: { appointments: true } },
      },
      orderBy: { order: "asc" },
    }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true, title: true }, orderBy: { order: "asc" } }),
    prisma.timeOff.findMany({
      where: { to: { gte: new Date() } },
      include: { staff: { select: { name: true } } },
      orderBy: { from: "asc" },
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="پرسنل"
        description="برنامه‌ی هفتگی هر نفر تعیین می‌کند چه ساعت‌هایی برای رزرو آنلاین باز باشد."
        action={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <TimeOffForm staff={staff.map((s) => ({ id: s.id, name: s.name }))} />
              <StaffForm services={services} />
            </div>
          ) : null
        }
      />

      {timeOffs.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <CalendarOff className="size-[18px] text-rose-500" />
            مرخصی‌ها و تعطیلی‌های پیش‌رو
          </h2>
          <ul className="space-y-2.5">
            {timeOffs.map((off) => (
              <li
                key={off.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] p-3.5"
              >
                <div>
                  <p className="text-sm font-medium">
                    {off.staff?.name ?? "کل کلینیک"}
                    {off.reason && (
                      <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
                        ({off.reason})
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                    {formatJalaliLong(off.from)} ساعت {formatTime(off.from)} تا{" "}
                    {formatJalaliLong(off.to)} ساعت {formatTime(off.to)}
                  </p>
                </div>
                {canEdit && (
                  <ActionButton
                    action={deleteTimeOff.bind(null, off.id)}
                    confirm="این مرخصی حذف شود؟"
                    title="حذف مرخصی"
                    className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {staff.length === 0 ? (
        <EmptyState icon={Users} title="پرسنلی ثبت نشده" description="با دکمه‌ی «افزودن پرسنل» شروع کنید." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {staff.map((member) => (
            <Card key={member.id}>
              <div className="flex gap-4">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--bg-sunken)]">
                  {member.avatar && (
                    <Image src={member.avatar} alt="" fill sizes="64px" className="object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{member.name}</h2>
                    {!member.isActive && <Badge tone="red">غیرفعال</Badge>}
                    {!member.acceptsBookings && <Badge tone="neutral">بدون رزرو</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]">{member.title}</p>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                    {toFa(member._count.appointments)} نوبت ثبت‌شده
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[color:var(--line)] pt-5">
                <div className="rounded-2xl bg-[color:var(--bg-sunken)] p-3 text-center">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">حقوق پایه</p>
                  <p className="mt-1 text-sm font-bold">
                    {member.baseSalary > 0 ? formatToman(member.baseSalary) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[color:var(--bg-sunken)] p-3 text-center">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">پورسانت</p>
                  <p className="mt-1 text-sm font-bold">{toFa(member.commissionPercent)}٪</p>
                </div>
              </div>

              <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                <p className="mb-2.5 text-xs font-semibold">برنامه‌ی هفتگی</p>
                {member.schedules.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ برنامه‌ای ثبت نشده — این پرسنل در رزرو آنلاین نمایش داده نمی‌شود.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {member.schedules.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-lg bg-[color:var(--bg-sunken)] px-2.5 py-1 text-[11px]"
                      >
                        {WEEKDAYS_FA[s.weekday]} {toFa(s.startTime)}–{toFa(s.endTime)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                <p className="mb-2.5 text-xs font-semibold">خدمات ({toFa(member.services.length)})</p>
                {member.services.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ خدمتی انتخاب نشده — در رزرو آنلاین پیشنهاد نمی‌شود.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {member.services.map((s) => (
                      <span
                        key={s.serviceId}
                        className="rounded-lg border border-[color:var(--line)] px-2.5 py-1 text-[11px]"
                      >
                        {s.service.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--line)] pt-5">
                {canEdit && (
                  <>
                    <StaffForm
                      services={services}
                      member={{
                        id: member.id,
                        name: member.name,
                        title: member.title,
                        bio: member.bio,
                        avatar: member.avatar,
                        licenseNo: member.licenseNo,
                        instagram: member.instagram,
                        baseSalary: member.baseSalary,
                        commissionPercent: member.commissionPercent,
                        order: member.order,
                        isActive: member.isActive,
                        acceptsBookings: member.acceptsBookings,
                        serviceIds: member.services.map((s) => s.serviceId),
                      }}
                    />
                    <ScheduleForm
                      staffId={member.id}
                      staffName={member.name}
                      schedules={member.schedules.map((s) => ({
                        weekday: s.weekday,
                        startTime: s.startTime,
                        endTime: s.endTime,
                      }))}
                    />
                  </>
                )}

                <ActionButton action={toggleStaffActive.bind(null, member.id)}>
                  {member.isActive ? (
                    <>
                      <EyeOff className="size-3.5" /> غیرفعال
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5" /> فعال
                    </>
                  )}
                </ActionButton>

                {canEdit && (
                  <ActionButton
                    action={deleteStaff.bind(null, member.id)}
                    confirm={`«${member.name}» حذف شود؟`}
                    title="حذف پرسنل"
                    className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
