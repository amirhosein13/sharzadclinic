import { MailOpen, MessageSquare, Phone, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { deleteMessage, toggleMessageRead } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { timeAgoFa } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  await guardPage("messages");
  const messages = await prisma.contactMessage.findMany({
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
  });

  const unread = messages.filter((m) => !m.isRead).length;

  return (
    <>
      <AdminPageHeader
        title="پیام‌های تماس"
        description={
          unread > 0 ? `${toFa(unread)} پیام خوانده‌نشده دارید.` : "همه‌ی پیام‌ها خوانده شده‌اند."
        }
      />

      {messages.length === 0 ? (
        <EmptyState icon={MessageSquare} title="پیامی دریافت نشده" />
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <Card key={m.id} className={m.isRead ? "" : "border-rose-300/60 dark:border-rose-300/25"}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{m.name}</h2>
                    {!m.isRead && <Badge tone="rose">جدید</Badge>}
                  </div>
                  {m.subject && (
                    <p className="mt-1 text-sm text-[color:var(--fg-muted)]">موضوع: {m.subject}</p>
                  )}
                </div>
                <p className="text-xs text-[color:var(--fg-muted)]">{timeAgoFa(m.createdAt)}</p>
              </div>

              <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[color:var(--fg-muted)]">
                {m.body}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color:var(--line)] pt-4">
                <a
                  href={`tel:${m.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
                >
                  <Phone className="size-3.5" />
                  <span dir="ltr">{toFa(m.phone)}</span>
                </a>
                {m.email && (
                  <a
                    href={`mailto:${m.email}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--bg-sunken)]"
                    dir="ltr"
                  >
                    {m.email}
                  </a>
                )}
                <div className="mr-auto flex gap-2">
                  <ActionButton action={toggleMessageRead.bind(null, m.id)}>
                    <MailOpen className="size-3.5" />
                    {m.isRead ? "خوانده‌نشده" : "خوانده شد"}
                  </ActionButton>
                  <ActionButton
                    action={deleteMessage.bind(null, m.id)}
                    confirm="این پیام حذف شود؟"
                    className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
