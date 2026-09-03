/**
 * گزارش شبانه‌ی خلاصه‌ی روز برای مدیر.
 *
 * اجرا:  npm run digest
 * روی سرور با cron، مثلاً هر شب ساعت ۹:
 *   0 21 * * *  cd /path/to/app && npm run digest >> /var/log/sharzad.log 2>&1
 *
 * گزینه‌ها:
 *   --dry    فقط متن را چاپ کن، پیامک نفرست
 *   --force  حتی اگر روز خالی بوده یا تنظیم خاموش است، بفرست
 */
import "../src/lib/timezone";
import { buildDailyDigest, digestRecipient } from "../src/lib/daily-digest";
import { notifyDailyDigest } from "../src/lib/notifications";
import { getSettings } from "../src/lib/settings";
import { prisma } from "../src/lib/prisma";

async function main() {
  const dry = process.argv.includes("--dry");
  const force = process.argv.includes("--force");

  const digest = await buildDailyDigest();
  console.log("─".repeat(46));
  console.log(digest.message);
  console.log("─".repeat(46));

  if (dry) {
    console.log("\n(حالت آزمایشی — پیامکی ارسال نشد)");
    return;
  }

  const settings = await getSettings();
  if (settings.dailyDigestSms !== "1" && !force) {
    console.log("\nگزارش شبانه در تنظیمات خاموش است. (با --force به‌زور بفرست)");
    return;
  }

  if (digest.isEmpty && !force) {
    console.log("\nامروز اتفاقی نیفتاده — پیامکی فرستاده نشد.");
    return;
  }

  const phone = await digestRecipient();
  if (!phone) {
    console.error(
      "\n❌ شماره‌ی مدیر تنظیم نشده. پنل ← تنظیمات ← «موبایل مدیر (گزارش شبانه)»",
    );
    process.exitCode = 1;
    return;
  }

  const result = await notifyDailyDigest(phone, digest.message);
  console.log(result.ok ? `\n✅ برای ${phone} ارسال شد.` : `\n❌ ارسال نشد: ${result.error}`);
  if (!result.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("❌ گزارش شبانه ناموفق بود:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
