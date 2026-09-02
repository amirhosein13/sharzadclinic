/**
 * پشتیبان‌گیری خودکار — برای اجرا با cron روی سرور.
 *   npm run backup            نسخه‌ی کامل (با عکس‌ها)
 *   npm run backup -- --light فقط اطلاعات، بدون عکس‌ها
 */
import "../src/lib/timezone";
import { createBackup, formatBytes, pruneBackups } from "../src/lib/backup";
import { prisma } from "../src/lib/prisma";
import { formatJalaliDateTime } from "../src/lib/date";
import { toFa } from "../src/lib/utils";

const KEEP = Number(process.env.BACKUP_KEEP) || 14;

async function main() {
  const light = process.argv.includes("--light");
  const startedAt = Date.now();

  console.log(`🗄️  پشتیبان‌گیری — ${formatJalaliDateTime(new Date())}`);

  const result = await createBackup({ includeFiles: !light });
  const removed = await pruneBackups(KEEP);
  const seconds = Math.round((Date.now() - startedAt) / 1000);

  const rows = Object.values(result.manifest.counts).reduce((a, b) => a + b, 0);
  console.log(`   فایل: ${result.filename}`);
  console.log(`   حجم: ${formatBytes(result.bytes)} • ${toFa(rows)} رکورد • ${toFa(seconds)} ثانیه`);
  console.log(`   عکس‌ها: ${result.manifest.includesFiles ? "دارد" : "ندارد"}`);
  if (removed > 0) console.log(`   ${toFa(removed)} نسخه‌ی قدیمی پاک شد (نگهداری ${toFa(KEEP)} تای آخر)`);
  console.log("✅ انجام شد.");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("❌ پشتیبان‌گیری ناموفق بود:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
