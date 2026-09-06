import { BookOpen } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminPageHeader, Card } from "@/components/admin/page-header";
import { GuideView } from "@/components/admin/guide-view";
import { guideFor } from "@/lib/guide";
import { can, ROLE_LABELS, type Permission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const user = await getSession();
  if (!user) redirect("/admin/login");

  // فقط چیزهایی که این نقش واقعاً می‌تواند انجام دهد — راهنمای شلوغ خوانده نمی‌شود
  const sections = guideFor((permission: Permission) => can(user.role, permission));

  return (
    <>
      <AdminPageHeader
        title="راهنما"
        description="هر کاری که در پنل انجام می‌دهید، قدم‌به‌قدم. اگر جایی گیر کردید، اول این‌جا را ببینید."
      />

      <Card className="mb-6 border-rose-200 bg-gradient-to-bl from-rose-50 to-cream-50 dark:border-rose-300/20 dark:from-rose-500/10 dark:to-plum-800/40">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white">
            <BookOpen className="size-5" />
          </span>
          <div>
            <p className="font-bold">
              {user.name} عزیز، این راهنما برای «{ROLE_LABELS[user.role]}» تنظیم شده
            </p>
            <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
              فقط بخش‌هایی را می‌بینید که خودتان به آن‌ها دسترسی دارید. لازم نیست همه‌اش را
              بخوانید — روی هر عنوان بزنید تا باز شود، یا بالای صفحه دنبال کلمه‌ای که
              می‌خواهید بگردید.
            </p>
          </div>
        </div>
      </Card>

      <GuideView sections={sections} />
    </>
  );
}
