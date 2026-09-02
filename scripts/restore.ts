/**
 * بازگردانی از فایل پشتیبان.
 *   npm run restore -- storage/backups/sharzad-backup-1405-06-12-0300.zip
 *
 * ⚠️ داده‌ی فعلی را پاک و با محتوای پشتیبان جایگزین می‌کند. برای جلوگیری
 * از اشتباه، بدون --yes فقط گزارش می‌دهد که قرار است چه اتفاقی بیفتد.
 */
import "../src/lib/timezone";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import unzipper from "unzipper";
import { BACKUP_TABLES, type BackupTable } from "../src/lib/backup";
import { toFa } from "../src/lib/utils";

const prisma = new PrismaClient();

type Delegate = {
  createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
  deleteMany: (args?: unknown) => Promise<{ count: number }>;
};
const delegate = (table: BackupTable): Delegate =>
  (prisma as unknown as Record<string, Delegate>)[table];

/** رشته‌های تاریخ در JSON باید دوباره Date شوند */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function reviveDates(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "string" && ISO.test(value) ? new Date(value) : value;
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const file = args.find((a) => !a.startsWith("--"));
  const confirmed = args.includes("--yes");
  const withFiles = !args.includes("--no-files");

  if (!file) {
    console.error("مسیر فایل پشتیبان را بدهید:\n  npm run restore -- storage/backups/....zip");
    process.exit(1);
  }

  const directory = await unzipper.Open.file(file);
  const manifestEntry = directory.files.find((f) => f.path === "manifest.json");
  if (!manifestEntry) {
    console.error("❌ این فایل پشتیبانِ این برنامه نیست (manifest.json ندارد).");
    process.exit(1);
  }

  const manifest = JSON.parse((await manifestEntry.buffer()).toString("utf8")) as {
    createdAtJalali: string;
    counts: Record<string, number>;
    includesFiles: boolean;
  };

  const total = Object.values(manifest.counts).reduce((a, b) => a + b, 0);
  console.log(`\n📦 پشتیبانِ ${manifest.createdAtJalali} — ${toFa(total)} رکورد`);
  console.log(`   عکس‌ها: ${manifest.includesFiles ? "دارد" : "ندارد"}\n`);

  for (const [table, count] of Object.entries(manifest.counts)) {
    if (count > 0) console.log(`   ${table.padEnd(20, " ")} ${toFa(count)}`);
  }

  if (!confirmed) {
    console.log("\n⚠️  این کار همه‌ی داده‌ی فعلی را پاک می‌کند.");
    console.log("   اگر مطمئنی، دوباره با ‎--yes‎ اجرا کن:");
    console.log(`   npm run restore -- ${file} --yes\n`);
    await prisma.$disconnect();
    return;
  }

  // پاک‌کردن از برگ به ریشه تا کلید خارجی نشکند
  console.log("\n🧹 پاک‌کردن داده‌ی فعلی...");
  for (const table of [...BACKUP_TABLES].reverse()) {
    await delegate(table).deleteMany({});
  }

  console.log("📥 بازگردانی...");
  for (const table of BACKUP_TABLES) {
    const entry = directory.files.find((f) => f.path === `data/${table}.json`);
    if (!entry) continue;
    const rows = JSON.parse((await entry.buffer()).toString("utf8")) as Record<string, unknown>[];
    if (rows.length === 0) continue;

    // دسته‌دسته، تا برای جدول‌های بزرگ حافظه پر نشود
    for (let i = 0; i < rows.length; i += 500) {
      await delegate(table).createMany({ data: rows.slice(i, i + 500).map(reviveDates) });
    }
    console.log(`   ${table.padEnd(20, " ")} ${toFa(rows.length)}`);
  }

  if (withFiles && manifest.includesFiles) {
    console.log("🖼️  بازگردانی فایل‌ها...");
    const privateDir = process.env.PRIVATE_UPLOAD_DIR
      ? join(process.env.PRIVATE_UPLOAD_DIR)
      : join(process.cwd(), "storage", "private");
    const targets: Record<string, string> = {
      "files/uploads-public": join(process.cwd(), "public", "uploads"),
      "files/uploads-private": privateDir,
    };

    let restored = 0;
    for (const entry of directory.files) {
      if (entry.type !== "File") continue;
      const prefix = Object.keys(targets).find((p) => entry.path.startsWith(`${p}/`));
      if (!prefix) continue;

      const target = join(targets[prefix], entry.path.slice(prefix.length + 1));
      await mkdir(dirname(target), { recursive: true });
      await pipeline(Readable.from(await entry.buffer()), createWriteStream(target));
      restored++;
    }
    console.log(`   ${toFa(restored)} فایل`);
  }

  console.log("\n✅ بازگردانی کامل شد.\n");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("❌ بازگردانی ناموفق بود:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
