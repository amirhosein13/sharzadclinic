import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

/**
 * جنبه‌هایی که مشتری می‌تواند بگوید از کدامشان راضی بوده و از کدام نه.
 * کلیدها در دیتابیس ذخیره می‌شوند، پس تغییرشان سوابق را می‌شکند —
 * برای اضافه‌کردن جنبه‌ی تازه، کلید جدید بساز و قدیمی را نگه دار.
 */
export const FEEDBACK_ASPECTS = [
  { key: "result", label: "نتیجه‌ی درمان" },
  { key: "expertise", label: "تخصص و مهارت" },
  { key: "staff", label: "برخورد پرسنل" },
  { key: "reception", label: "برخورد پذیرش" },
  { key: "cleanliness", label: "نظافت و بهداشت" },
  { key: "punctuality", label: "سر وقت بودن نوبت" },
  { key: "waiting", label: "زمان انتظار" },
  { key: "environment", label: "محیط و امکانات" },
  { key: "price", label: "قیمت" },
  { key: "booking", label: "روند نوبت‌دهی" },
  { key: "guidance", label: "توضیحات پیش و پس از درمان" },
  { key: "followup", label: "پیگیری بعد از درمان" },
] as const;

export type AspectKey = (typeof FEEDBACK_ASPECTS)[number]["key"];

const ASPECT_LABELS = new Map(FEEDBACK_ASPECTS.map((a) => [a.key, a.label]));

export function aspectLabel(key: string): string {
  return ASPECT_LABELS.get(key as AspectKey) ?? key;
}

/** فقط کلیدهای شناخته‌شده ذخیره می‌شوند تا گزارش‌ها آلوده نشوند */
export function sanitizeAspects(values: string[]): string[] {
  return [...new Set(values.filter((v) => ASPECT_LABELS.has(v as AspectKey)))];
}

export function newFeedbackToken(): string {
  return randomBytes(16).toString("hex");
}

/** زیر این امتیاز، نظر «نارضایتی» شمرده می‌شود و باید پیگیری شود */
export const UNHAPPY_THRESHOLD = 3;

export const FEEDBACK_STATUS_META: Record<
  string,
  { label: string; tone: "amber" | "plum" | "green" | "neutral" }
> = {
  NEW: { label: "ارسال‌شده، هنوز پر نشده", tone: "neutral" },
  SUBMITTED: { label: "نظر تازه", tone: "amber" },
  SEEN: { label: "دیده شد", tone: "plum" },
  RESOLVED: { label: "رسیدگی شد", tone: "green" },
};

export type SatisfactionReport = {
  responses: number;
  invitesSent: number;
  responseRate: number;
  averageRating: number;
  /** درصد امتیاز ۴ و ۵ */
  happyRate: number;
  /** درصد امتیاز ۱ تا ۳ */
  unhappyRate: number;
  recommendRate: number;
  openComplaints: number;
  distribution: { stars: number; count: number }[];
  complaints: { key: string; label: string; count: number }[];
  praises: { key: string; label: string; count: number }[];
  byService: { key: string; label: string; responses: number; average: number }[];
  byStaff: { key: string; label: string; responses: number; average: number }[];
  recent: {
    id: string;
    customerName: string;
    rating: number | null;
    comment: string | null;
    badTags: string[];
    serviceTitle: string | null;
    submittedAt: Date | null;
  }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** همه‌ی اعداد رضایت در یک بازه */
export async function buildSatisfaction(from: Date, to: Date): Promise<SatisfactionReport> {
  const [answered, invitesSent, openComplaints] = await Promise.all([
    prisma.feedback.findMany({
      where: { submittedAt: { gte: from, lte: to }, rating: { not: null } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { title: true } },
        staff: { select: { name: true } },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.feedback.count({ where: { sentAt: { gte: from, lte: to } } }),
    prisma.feedback.count({
      where: {
        submittedAt: { gte: from, lte: to },
        rating: { lte: UNHAPPY_THRESHOLD },
        status: { in: ["SUBMITTED", "SEEN"] },
      },
    }),
  ]);

  const responses = answered.length;
  const sum = answered.reduce((acc, f) => acc + (f.rating ?? 0), 0);
  const happy = answered.filter((f) => (f.rating ?? 0) >= 4).length;
  const unhappy = answered.filter((f) => (f.rating ?? 0) <= UNHAPPY_THRESHOLD).length;
  const recommendAnswers = answered.filter((f) => f.wouldRecommend !== null);
  const recommendYes = recommendAnswers.filter((f) => f.wouldRecommend).length;

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: answered.filter((f) => f.rating === stars).length,
  }));

  const tally = (pick: (f: (typeof answered)[number]) => string[]) => {
    const counts = new Map<string, number>();
    for (const f of answered) for (const tag of pick(f)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()]
      .map(([key, count]) => ({ key, label: aspectLabel(key), count }))
      .sort((a, b) => b.count - a.count);
  };

  const group = (
    pick: (f: (typeof answered)[number]) => { key: string; label: string } | null,
  ) => {
    const rows = new Map<string, { key: string; label: string; responses: number; total: number }>();
    for (const f of answered) {
      const target = pick(f);
      if (!target) continue;
      const row = rows.get(target.key) ?? { ...target, responses: 0, total: 0 };
      row.responses++;
      row.total += f.rating ?? 0;
      rows.set(target.key, row);
    }
    return [...rows.values()]
      .map((r) => ({ key: r.key, label: r.label, responses: r.responses, average: round1(r.total / r.responses) }))
      .sort((a, b) => a.average - b.average || b.responses - a.responses);
  };

  return {
    responses,
    invitesSent,
    responseRate: percent(responses, invitesSent),
    averageRating: responses ? round1(sum / responses) : 0,
    happyRate: percent(happy, responses),
    unhappyRate: percent(unhappy, responses),
    recommendRate: percent(recommendYes, recommendAnswers.length),
    openComplaints,
    distribution,
    complaints: tally((f) => f.badTags),
    praises: tally((f) => f.goodTags),
    byService: group((f) => (f.serviceId ? { key: f.serviceId, label: f.service?.title ?? "نامشخص" } : null)),
    byStaff: group((f) => (f.staffId ? { key: f.staffId, label: f.staff?.name ?? "نامشخص" } : null)),
    recent: answered.slice(0, 8).map((f) => ({
      id: f.id,
      customerName: `${f.customer.firstName} ${f.customer.lastName}`,
      rating: f.rating,
      comment: f.comment,
      badTags: f.badTags,
      serviceTitle: f.service?.title ?? null,
      submittedAt: f.submittedAt,
    })),
  };
}
