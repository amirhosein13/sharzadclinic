import Link from "next/link";
import { MessageSquareHeart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { FeedbackCard, type FeedbackView } from "@/components/admin/feedback-card";
import { aspectLabel, FEEDBACK_STATUS_META, UNHAPPY_THRESHOLD } from "@/lib/feedback";
import { formatJalaliLong, timeAgoFa } from "@/lib/date";
import { toFa } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "open", label: "نیاز به رسیدگی" },
  { key: "unhappy", label: "ناراضی‌ها" },
  { key: "all", label: "همه‌ی نظرها" },
  { key: "waiting", label: "پر نشده" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function whereFor(filter: FilterKey): Prisma.FeedbackWhereInput {
  switch (filter) {
    case "unhappy":
      return { rating: { lte: UNHAPPY_THRESHOLD } };
    case "all":
      return { submittedAt: { not: null } };
    case "waiting":
      return { submittedAt: null };
    case "open":
    default:
      return { submittedAt: { not: null }, status: { in: ["SUBMITTED", "SEEN"] } };
  }
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await guardPage("content");

  const { filter: raw } = await searchParams;
  const filter = (FILTERS.find((f) => f.key === raw)?.key ?? "open") as FilterKey;

  const [rows, counts] = await Promise.all([
    prisma.feedback.findMany({
      where: whereFor(filter),
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        service: { select: { title: true } },
        staff: { select: { name: true } },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.$transaction([
      prisma.feedback.count({ where: whereFor("open") }),
      prisma.feedback.count({ where: whereFor("unhappy") }),
      prisma.feedback.count({ where: whereFor("all") }),
      prisma.feedback.count({ where: whereFor("waiting") }),
    ]),
  ]);

  const countByKey: Record<FilterKey, number> = {
    open: counts[0],
    unhappy: counts[1],
    all: counts[2],
    waiting: counts[3],
  };

  const items: FeedbackView[] = rows.map((f) => {
    const meta = FEEDBACK_STATUS_META[f.status] ?? FEEDBACK_STATUS_META.NEW;
    return {
      id: f.id,
      customerId: f.customer.id,
      customerName: `${f.customer.firstName} ${f.customer.lastName}`,
      phone: f.customer.phone,
      rating: f.rating,
      goodLabels: f.goodTags.map(aspectLabel),
      badLabels: f.badTags.map(aspectLabel),
      comment: f.comment,
      wouldRecommend: f.wouldRecommend,
      canPublish: f.canPublish,
      status: f.status,
      statusLabel: meta.label,
      statusTone: meta.tone,
      managerNote: f.managerNote,
      replyToCustomer: f.replyToCustomer,
      serviceTitle: f.service?.title ?? null,
      staffName: f.staff?.name ?? null,
      submittedLabel: f.submittedAt
        ? `${formatJalaliLong(f.submittedAt)} (${timeAgoFa(f.submittedAt)})`
        : f.sentAt
          ? `دعوت‌نامه ${timeAgoFa(f.sentAt)} فرستاده شد`
          : null,
      isUnhappy: (f.rating ?? 5) <= UNHAPPY_THRESHOLD,
    };
  });

  return (
    <>
      <AdminPageHeader
        title="نظر مشتری‌ها"
        description={
          countByKey.open > 0
            ? `${toFa(countByKey.open)} نظر منتظر رسیدگی شماست.`
            : "همه‌ی نظرها رسیدگی شده‌اند."
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/feedback?filter=${f.key}`}
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

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquareHeart}
            title="نظری در این دسته نیست"
            description="پس از «انجام‌شده» شدن هر نوبت، پیامک نظرسنجی خودکار برای مشتری می‌رود."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <FeedbackCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
