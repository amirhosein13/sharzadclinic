/**
 * داده‌ی نمونه برای آزمایش بخش «رضایت مشتری‌ها».
 *
 *   npm run demo:feedback           ۲۵ نظر نمونه در ۳۰ روز گذشته می‌سازد
 *   npm run demo:feedback -- 60     تعداد دلخواه
 *   npm run demo:feedback -- --clean  همه‌ی نظرهای نمونه را پاک می‌کند
 *
 * فقط برای تست است. نظرهای نمونه با پیشوند توکن «demo-» شناخته و پاک
 * می‌شوند، پس با نظرهای واقعی مشتری‌ها قاطی نمی‌شوند.
 */
import "../src/lib/timezone";
import { prisma } from "../src/lib/prisma";
import { FEEDBACK_ASPECTS } from "../src/lib/feedback";
import { toFa } from "../src/lib/utils";

const ASPECTS = FEEDBACK_ASPECTS.map((a) => a.key);

const HAPPY_COMMENTS = [
  "خیلی راضی بودم، حتماً دوباره می‌آیم.",
  "برخوردشان عالی بود و نتیجه بهتر از انتظارم شد.",
  "محیط تمیز و آرامی داشت. ممنون.",
  "دکتر با حوصله همه‌چیز را توضیح داد.",
  "",
  "",
];
const MEH_COMMENTS = [
  "کار خوب بود ولی کمی معطل شدم.",
  "نتیجه راضی‌کننده بود، قیمتش برایم سنگین بود.",
  "",
];
const ANGRY_COMMENTS = [
  "نیم ساعت پشت در منتظر ماندم و کسی جواب‌گو نبود.",
  "نتیجه‌ای که گفته بودند نگرفتم و پیگیری هم نکردند.",
  "برخورد پذیرش اصلاً خوب نبود.",
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const pickSome = (list: readonly string[], max: number) => {
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.floor(Math.random() * (max + 1)));
};

async function main() {
  if (process.argv.includes("--clean")) {
    const removed = await prisma.feedback.deleteMany({ where: { token: { startsWith: "demo-" } } });
    console.log(`🧹 ${toFa(removed.count)} نظر نمونه پاک شد.`);
    return;
  }

  const count = Number(process.argv.find((a) => /^\d+$/.test(a))) || 25;

  const [customers, services, staff] = await Promise.all([
    prisma.customer.findMany({ select: { id: true } }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true } }),
    prisma.staff.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);

  if (customers.length === 0 || services.length === 0) {
    console.error("❌ اول باید مشتری و خدمت داشته باشی. `npm run db:seed` را روی دیتابیس خالی بزن.");
    process.exitCode = 1;
    return;
  }

  const rows = [];
  for (let i = 0; i < count; i++) {
    // توزیع واقع‌گرایانه: بیشترشان راضی، چندتایی ناراضی
    const roll = Math.random();
    const rating = roll < 0.55 ? 5 : roll < 0.78 ? 4 : roll < 0.9 ? 3 : roll < 0.97 ? 2 : 1;

    const good = rating >= 4 ? pickSome(ASPECTS, 4) : pickSome(ASPECTS, 2);
    const bad =
      rating >= 4
        ? pickSome(ASPECTS, 1).filter((t) => !good.includes(t))
        : pickSome(["waiting", "price", "reception", "result", "followup"], 3).filter(
            (t) => !good.includes(t),
          );

    const comment =
      rating >= 4 ? pick(HAPPY_COMMENTS) : rating === 3 ? pick(MEH_COMMENTS) : pick(ANGRY_COMMENTS);

    const daysAgo = Math.floor(Math.random() * 30);
    const submittedAt = new Date();
    submittedAt.setDate(submittedAt.getDate() - daysAgo);
    submittedAt.setHours(10 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);

    const sentAt = new Date(submittedAt.getTime() - 3 * 3600_000);

    rows.push({
      customerId: pick(customers).id,
      serviceId: pick(services).id,
      staffId: staff.length ? pick(staff).id : null,
      token: `demo-${Math.random().toString(36).slice(2)}${i}`,
      rating,
      goodTags: good,
      badTags: bad,
      comment: comment || null,
      wouldRecommend: rating >= 4 ? true : rating === 3 ? null : false,
      canPublish: rating === 5 && !!comment,
      status: rating <= 3 && Math.random() < 0.6 ? ("SUBMITTED" as const) : ("SEEN" as const),
      sentAt,
      submittedAt,
    });
  }

  // چند دعوت‌نامه‌ی بی‌پاسخ هم بساز تا «نرخ پاسخ» واقعی شود
  const unanswered = Math.round(count * 0.4);
  for (let i = 0; i < unanswered; i++) {
    const sentAt = new Date();
    sentAt.setDate(sentAt.getDate() - Math.floor(Math.random() * 30));
    rows.push({
      customerId: pick(customers).id,
      serviceId: pick(services).id,
      staffId: staff.length ? pick(staff).id : null,
      token: `demo-none-${Math.random().toString(36).slice(2)}${i}`,
      rating: null,
      goodTags: [],
      badTags: [],
      comment: null,
      wouldRecommend: null,
      canPublish: false,
      status: "NEW" as const,
      sentAt,
      submittedAt: null,
    });
  }

  await prisma.feedback.createMany({ data: rows });

  const answered = rows.filter((r) => r.rating !== null);
  const avg = answered.reduce((s, r) => s + (r.rating ?? 0), 0) / answered.length;
  console.log(`✅ ${toFa(answered.length)} نظر و ${toFa(unanswered)} دعوت‌نامه‌ی بی‌پاسخ ساخته شد.`);
  console.log(`   میانگین امتیاز: ${toFa(Math.round(avg * 10) / 10)} از ۵`);
  console.log(`   ناراضی (۳ و کمتر): ${toFa(answered.filter((r) => (r.rating ?? 5) <= 3).length)}`);
  console.log("\n   حالا ببین:  /admin/feedback  و  /admin/reports");
  console.log("   برای پاک‌کردن:  npm run demo:feedback -- --clean");
}

main()
  .catch((error) => {
    console.error("❌ ساخت داده‌ی نمونه ناموفق بود:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
