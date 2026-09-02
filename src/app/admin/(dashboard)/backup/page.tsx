import { redirect } from "next/navigation";
import { DatabaseBackup, Download, ShieldCheck, TriangleAlert } from "lucide-react";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { BackupButton } from "@/components/admin/backup-button";
import { formatBytes, listBackups } from "@/lib/backup";
import { formatJalaliLong, timeAgoFa } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  const user = await guardPage("settings");
  // پشتیبان شامل کل پرونده‌های پزشکی است — فقط مدیر کل
  if (user.role !== "ADMIN") redirect("/admin");

  const backups = await listBackups();
  const latest = backups[0];
  const daysSince = latest
    ? Math.floor((Date.now() - latest.createdAt.getTime()) / 86_400_000)
    : null;
  const stale = daysSince === null || daysSince >= 2;

  return (
    <>
      <AdminPageHeader
        title="پشتیبان‌گیری"
        description="یک نسخه از همه‌ی اطلاعات کلینیک — مشتری‌ها، نوبت‌ها، پرونده‌ها، پرداخت‌ها و عکس‌ها."
      />

      <div
        className={
          stale
            ? "mb-6 flex items-start gap-4 rounded-3xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-400/30 dark:bg-amber-500/10"
            : "mb-6 flex items-start gap-4 rounded-3xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-400/30 dark:bg-emerald-500/10"
        }
      >
        <span className="mt-0.5 shrink-0">
          {stale ? (
            <TriangleAlert className="size-6 text-amber-600 dark:text-amber-300" />
          ) : (
            <ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-300" />
          )}
        </span>
        <div className="min-w-0">
          <p className="font-bold">
            {latest
              ? `آخرین پشتیبان: ${timeAgoFa(latest.createdAt)}`
              : "هنوز هیچ پشتیبانی گرفته نشده است"}
          </p>
          <p className="mt-1.5 text-sm leading-7">
            {latest
              ? stale
                ? "بهتر است یک نسخه‌ی تازه بگیرید و روی گوشی یا رایانه‌تان نگه دارید."
                : "همه‌چیز مرتب است. یک نسخه هم روی گوشی خودتان داشته باشید."
              : "دکمه‌ی زیر را بزنید تا یک نسخه ساخته و دانلود شود."}
          </p>
        </div>
      </div>

      <Card>
        <h2 className="mb-2 font-bold">گرفتن نسخه‌ی پشتیبان</h2>
        <p className="mb-6 text-sm leading-8 text-[color:var(--fg-muted)]">
          یک فایل zip ساخته می‌شود و روی همین دستگاه دانلود می‌شود. اگر با گوشی
          باز کرده‌اید، فایل در بخش «دانلودها»ی گوشی می‌نشیند — از همان‌جا می‌توانید
          برای خودتان در تلگرام یا ایمیل بفرستید تا جای امنی بماند.
        </p>

        <div className="flex flex-wrap gap-3">
          <BackupButton />
          <BackupButton withoutFiles />
        </div>

        <p className="mt-5 rounded-2xl bg-[color:var(--bg-sunken)] p-4 text-xs leading-7 text-[color:var(--fg-muted)]">
          ساخت پشتیبان کامل بسته به تعداد عکس‌ها ممکن است تا چند دقیقه طول بکشد.
          صفحه را نبندید تا دانلود شروع شود. اگر فقط می‌خواهید سریع یک نسخه از
          اطلاعات داشته باشید، گزینه‌ی «بدون عکس‌ها» خیلی سبک‌تر است.
        </p>
      </Card>

      <Card className="mt-6" padded={false}>
        <div className="border-b border-[color:var(--line)] p-6">
          <h2 className="font-bold">
            نسخه‌های روی سرور
            <span className="mr-2 text-xs font-normal text-[color:var(--fg-muted)]">
              ({toFa(backups.length)} نسخه)
            </span>
          </h2>
          <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
            سرور هر شب خودکار یک نسخه می‌گیرد و ۱۴ تای آخر را نگه می‌دارد.
          </p>
        </div>

        {backups.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={DatabaseBackup}
              title="نسخه‌ای روی سرور نیست"
              description="یا هنوز پشتیبان خودکار تنظیم نشده، یا اولین اجرایش نرسیده است."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {backups.map((file) => (
              <li key={file.filename} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" dir="ltr">
                    {file.filename}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                    {formatJalaliLong(file.createdAt)} • {formatBytes(file.bytes)}
                  </p>
                </div>
                <a
                  href={`/api/backup?file=${encodeURIComponent(file.filename)}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
                >
                  <Download className="size-3.5" />
                  دانلود
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 font-bold">اگر روزی لازم شد برگردانید</h2>
        <p className="text-sm leading-8 text-[color:var(--fg-muted)]">
          فایل پشتیبان را به کسی که سایت را راه انداخته بدهید؛ با یک دستور روی
          سرور همه‌چیز برمی‌گردد. خودتان کاری لازم نیست بکنید — فقط فایل را
          سالم نگه دارید.
        </p>
        <code className="mt-4 block overflow-x-auto rounded-xl bg-[color:var(--bg-sunken)] p-3.5 text-xs" dir="ltr">
          npm run restore -- storage/backups/sharzad-backup-....zip
        </code>
      </Card>
    </>
  );
}
