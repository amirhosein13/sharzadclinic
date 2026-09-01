import Image from "next/image";
import { Eye, EyeOff, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { toggleStaffActive } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { WEEKDAYS_FA } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const staff = await prisma.staff.findMany({
    include: {
      services: { include: { service: { select: { title: true } } } },
      schedules: { where: { isActive: true }, orderBy: { weekday: "asc" } },
      _count: { select: { appointments: true } },
    },
    orderBy: { order: "asc" },
  });

  return (
    <>
      <AdminPageHeader
        title="پرسنل"
        description="برنامه‌ی هفتگی هر نفر تعیین می‌کند چه ساعت‌هایی برای رزرو آنلاین باز باشد."
      />

      {staff.length === 0 ? (
        <EmptyState icon={Users} title="پرسنلی ثبت نشده" />
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
                <p className="mb-2.5 text-xs font-semibold">
                  خدمات ({toFa(member.services.length)})
                </p>
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
              </div>

              <div className="mt-5">
                <ActionButton action={toggleStaffActive.bind(null, member.id)}>
                  {member.isActive ? (
                    <>
                      <EyeOff className="size-3.5" /> غیرفعال کن
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5" /> فعال کن
                    </>
                  )}
                </ActionButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
