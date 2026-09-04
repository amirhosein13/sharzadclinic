import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { TicketThread, type StaffTicketView } from "@/components/admin/ticket-thread";
import { isUrgent, ticketCategoryLabel, TICKET_STATUS_META } from "@/lib/tickets";
import { formatJalaliDateTime, timeAgoFa } from "@/lib/date";
import { toFa } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "inbox", label: "نیاز به پاسخ" },
  { key: "all", label: "همه‌ی گفت‌وگوها" },
  { key: "closed", label: "بسته‌شده" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function whereFor(filter: FilterKey): Prisma.SupportTicketWhereInput {
  switch (filter) {
    case "all":
      return {};
    case "closed":
      return { status: "CLOSED" };
    case "inbox":
    default:
      return { status: { not: "CLOSED" }, lastSender: "CUSTOMER" };
  }
}

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await guardPage("messages");

  const { filter: raw } = await searchParams;
  const filter = (FILTERS.find((f) => f.key === raw)?.key ?? "inbox") as FilterKey;

  const [rows, counts] = await Promise.all([
    prisma.supportTicket.findMany({
      where: whereFor(filter),
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        messages: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 60,
    }),
    prisma.$transaction([
      prisma.supportTicket.count({ where: whereFor("inbox") }),
      prisma.supportTicket.count({ where: whereFor("all") }),
      prisma.supportTicket.count({ where: whereFor("closed") }),
    ]),
  ]);

  const countByKey: Record<FilterKey, number> = { inbox: counts[0], all: counts[1], closed: counts[2] };

  const tickets: StaffTicketView[] = rows.map((t) => {
    const meta = TICKET_STATUS_META[t.status];
    return {
      id: t.id,
      customerId: t.customer.id,
      customerName: `${t.customer.firstName} ${t.customer.lastName}`,
      phone: t.customer.phone,
      subject: t.subject,
      categoryLabel: ticketCategoryLabel(t.category),
      status: t.status,
      statusLabel: meta.label,
      statusTone: meta.tone,
      isUrgent: isUrgent(t.category, t.status),
      unread: t.unreadByStaff,
      updatedLabel: timeAgoFa(t.updatedAt),
      messages: t.messages.map((m) => ({
        id: m.id,
        fromClinic: m.sender === "STAFF",
        body: m.body,
        timeLabel: formatJalaliDateTime(m.createdAt),
        authorName: m.user?.name ?? null,
      })),
    };
  });

  // شکایت‌ها اول، بعد بقیه به ترتیب تازگی
  tickets.sort((a, b) => Number(b.isUrgent) - Number(a.isUrgent));

  return (
    <>
      <AdminPageHeader
        title="گفت‌وگو با مشتری‌ها"
        description={
          countByKey.inbox > 0
            ? `${toFa(countByKey.inbox)} گفت‌وگو منتظر پاسخ شماست.`
            : "همه‌ی پیام‌ها پاسخ داده شده‌اند."
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/tickets?filter=${f.key}`}
            className={
              f.key === filter
                ? "rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white"
                : "rounded-xl border border-[color:var(--line)] px-4 py-2 text-sm transition-colors hover:bg-[color:var(--bg-sunken)]"
            }
          >
            {f.label}
            <span className="mr-1.5 text-xs opacity-70">{toFa(countByKey[f.key])}</span>
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessagesSquare}
            title="گفت‌وگویی در این دسته نیست"
            description="مشتری‌ها از حساب کاربری‌شان می‌توانند پیام بفرستند و پاسخ شما برایشان پیامک می‌شود."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket, index) => (
            <TicketThread key={ticket.id} ticket={ticket} defaultOpen={index === 0 && ticket.unread} />
          ))}
        </div>
      )}
    </>
  );
}
