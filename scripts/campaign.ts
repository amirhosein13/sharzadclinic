/**
 * ادامه‌ی ارسال پیامک‌های گروهیِ نیمه‌تمام.
 *
 * روی سرور با cron، مثلاً هر ساعت:
 *   0 * * * *  cd /path/to/app && npm run campaign >> /var/log/sharzad.log 2>&1
 *
 * سقف روزانه در خود کتابخانه رعایت می‌شود؛ اگر پر شده باشد، این اسکریپت
 * بی‌سروصدا برمی‌گردد و فردا ادامه می‌دهد.
 */
import "../src/lib/timezone";
import {
  BATCH_SIZE,
  DAILY_LIMIT,
  pendingCampaigns,
  queuedCount,
  sendBatch,
  sentToday,
} from "../src/lib/campaigns";
import { prisma } from "../src/lib/prisma";
import { toFa } from "../src/lib/utils";

async function main() {
  const pending = await pendingCampaigns();
  if (pending.length === 0) {
    console.log("پیامک گروهیِ در انتظاری وجود ندارد.");
    return;
  }

  console.log(`📣 ${toFa(pending.length)} ارسال در جریان — امروز تا حالا ${toFa(await sentToday())} از ${toFa(DAILY_LIMIT)}`);

  for (const campaign of pending) {
    let guardCounter = 0;
    for (;;) {
      const before = await queuedCount(campaign.id);
      if (before === 0) break;

      const batch = await sendBatch(campaign.id, BATCH_SIZE);
      console.log(
        `   «${campaign.title}» — ${toFa(batch.sent)} رفت، ${toFa(batch.failed)} ناموفق، ${toFa(batch.remaining)} مانده`,
      );

      if (batch.stopped) {
        console.log(`   ⏸  ${batch.stopped}`);
        break;
      }
      // اگر دسته‌ای هیچ پیشرفتی نداشت، در حلقه‌ی بی‌پایان نمی‌مانیم
      if (batch.sent === 0 && batch.failed === 0) break;
      if (++guardCounter > 100) break;
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
