import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { WorkingHoursForm } from "@/components/admin/working-hours-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, workingHours] = await Promise.all([
    getSettings(),
    prisma.workingHour.findMany({ orderBy: { weekday: "asc" } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="تنظیمات"
        description="اطلاعات تماس، ساعات کاری و قوانین رزرو آنلاین. تغییرات بلافاصله روی سایت اعمال می‌شود."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsForm settings={settings} />
        <WorkingHoursForm
          hours={workingHours.map((h) => ({
            weekday: h.weekday,
            isOpen: h.isOpen,
            startTime: h.startTime,
            endTime: h.endTime,
          }))}
        />
      </div>
    </>
  );
}
