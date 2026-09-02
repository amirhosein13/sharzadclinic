import { Eye, EyeOff, FileSignature, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { ConsentTemplateForm } from "@/components/admin/forms/consent-template-form";
import { deleteConsentTemplate, toggleConsentTemplate } from "@/app/actions/consents";
import { Badge } from "@/components/ui/badge";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminConsentsPage() {
  await guardPage("content");

  const templates = await prisma.consentTemplate.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { signatures: true } } },
  });

  return (
    <>
      <AdminPageHeader
        title="رضایت‌نامه‌ها"
        description="متن‌هایی که پیش از درمان امضا می‌شوند. امضا در پرونده‌ی هر مشتری گرفته می‌شود."
        action={<ConsentTemplateForm />}
      />

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSignature}
            title="هنوز رضایت‌نامه‌ای ندارید"
            description="یک متن بسازید تا منشی بتواند هنگام پذیرش امضایش را بگیرد."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{t.title}</h2>
                    {t.isActive ? <Badge tone="green">فعال</Badge> : <Badge>غیرفعال</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                    {t._count.signatures > 0
                      ? `${toFa(t._count.signatures)} بار امضا شده`
                      : "هنوز امضا نشده"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <ConsentTemplateForm
                    template={{
                      id: t.id,
                      title: t.title,
                      slug: t.slug,
                      body: t.body,
                      order: t.order,
                      isActive: t.isActive,
                    }}
                  />
                  <ActionButton
                    action={toggleConsentTemplate.bind(null, t.id)}
                    title={t.isActive ? "غیرفعال کردن" : "فعال کردن"}
                    className="size-9 p-0"
                  >
                    {t.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </ActionButton>
                  <ActionButton
                    action={deleteConsentTemplate.bind(null, t.id)}
                    confirm="این رضایت‌نامه حذف شود؟"
                    title="حذف"
                    className="size-9 p-0 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-4" />
                  </ActionButton>
                </div>
              </div>

              <p className="mt-4 max-h-32 overflow-hidden rounded-xl bg-[color:var(--bg-sunken)] p-4 text-sm leading-8 whitespace-pre-wrap text-[color:var(--fg-muted)]">
                {t.body}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
