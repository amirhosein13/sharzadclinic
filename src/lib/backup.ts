import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import archiver from "archiver";
import { prisma } from "./prisma";
import { formatJalali } from "./date";
import { toEn } from "./utils";

/**
 * جدول‌ها به ترتیبِ وابستگی: هر جدول بعد از جدول‌هایی می‌آید که به آن‌ها
 * ارجاع می‌دهد. همین ترتیب موقع بازگردانی رعایت می‌شود تا کلید خارجی
 * نشکند. اگر مدل تازه‌ای به schema اضافه شد، حتماً این‌جا هم اضافه شود.
 */
export const BACKUP_TABLES = [
  "setting",
  "serviceCategory",
  "service",
  "serviceFaq",
  "staff",
  "staffOnService",
  "staffSchedule",
  "timeOff",
  "workingHour",
  "user",
  "customer",
  "package",
  "appointment",
  "treatmentRecord",
  "payment",
  "payrollPeriod",
  "otpCode",
  "notificationLog",
  "followUp",
  "consentTemplate",
  "consentSignature",
  "discountCode",
  "discountUse",
  "waitlistEntry",
  "feedback",
  "postCategory",
  "post",
  "testimonial",
  "galleryItem",
  "contactMessage",
  "auditLog",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

type Delegate = { findMany: (args?: unknown) => Promise<unknown[]>; createMany: (args: unknown) => Promise<unknown> };

function delegate(table: BackupTable): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[table];
}

export const BACKUP_DIR = process.env.BACKUP_DIR
  ? join(process.env.BACKUP_DIR)
  : join(process.cwd(), "storage", "backups");

/** پوشه‌هایی که فایل‌های آپلودشده در آن‌هاست */
function uploadDirs(): { path: string; label: string }[] {
  const privateDir = process.env.PRIVATE_UPLOAD_DIR
    ? join(process.env.PRIVATE_UPLOAD_DIR)
    : join(process.cwd(), "storage", "private");
  return [
    { path: join(process.cwd(), "public", "uploads"), label: "uploads-public" },
    { path: privateDir, label: "uploads-private" },
  ];
}

export type BackupManifest = {
  createdAt: string;
  createdAtJalali: string;
  appVersion: string;
  counts: Record<string, number>;
  includesFiles: boolean;
};

/** همه‌ی جدول‌ها را به شکل JSON می‌خواند */
async function exportTables(): Promise<{ data: Record<string, unknown[]>; counts: Record<string, number> }> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const rows = await delegate(table).findMany();
    data[table] = rows;
    counts[table] = rows.length;
  }
  return { data, counts };
}

export type BackupResult = {
  path: string;
  filename: string;
  bytes: number;
  manifest: BackupManifest;
};

/**
 * یک فایل zip می‌سازد شامل داده‌ی همه‌ی جدول‌ها و (در صورت درخواست)
 * تصاویر آپلودشده. با استریم نوشته می‌شود تا حافظه پر نشود.
 */
export async function createBackup(options: { includeFiles?: boolean } = {}): Promise<BackupResult> {
  const includeFiles = options.includeFiles ?? true;
  await mkdir(BACKUP_DIR, { recursive: true });

  const now = new Date();
  // نام فایل فقط لاتین، چون هدر دانلود و فایل‌سیستم با فارسی مشکل دارند
  const stamp = `${toEn(formatJalali(now, "yyyy-MM-dd"))}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
  const filename = `sharzad-backup-${stamp}.zip`;
  const path = join(BACKUP_DIR, filename);

  const { data, counts } = await exportTables();
  const manifest: BackupManifest = {
    createdAt: now.toISOString(),
    createdAtJalali: formatJalali(now, "yyyy/MM/dd"),
    appVersion: process.env.npm_package_version ?? "1.0.0",
    counts,
    includesFiles: includeFiles,
  };

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(path);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    // فایل گم‌شده نباید کل پشتیبان را خراب کند
    archive.on("warning", (err: { code?: string; message: string }) => {
      if (err.code === "ENOENT") console.warn("⚠️ پشتیبان:", err.message);
      else reject(err);
    });

    archive.pipe(output);
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    for (const [table, rows] of Object.entries(data)) {
      archive.append(JSON.stringify(rows), { name: `data/${table}.json` });
    }
    if (includeFiles) {
      for (const dir of uploadDirs()) {
        archive.directory(dir.path, `files/${dir.label}`);
      }
    }
    archive.finalize().catch(reject);
  });

  const info = await stat(path);
  return { path, filename, bytes: info.size, manifest };
}

export type StoredBackup = {
  filename: string;
  bytes: number;
  createdAt: Date;
};

/** فهرست پشتیبان‌های ذخیره‌شده روی سرور، تازه‌ترین اول */
export async function listBackups(): Promise<StoredBackup[]> {
  try {
    const names = await readdir(BACKUP_DIR);
    const files = await Promise.all(
      names
        .filter((n) => n.endsWith(".zip"))
        .map(async (filename) => {
          const info = await stat(join(BACKUP_DIR, filename));
          return { filename, bytes: info.size, createdAt: info.mtime };
        }),
    );
    return files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

/** فقط چند تای آخر را نگه می‌دارد تا دیسک پر نشود */
export async function pruneBackups(keep = 14): Promise<number> {
  const files = await listBackups();
  const extra = files.slice(keep);
  for (const file of extra) {
    await unlink(join(BACKUP_DIR, file.filename)).catch(() => undefined);
  }
  return extra.length;
}

/** نام فایل باید امن باشد تا از پوشه‌ی پشتیبان بیرون نرود */
export function isSafeBackupName(name: string): boolean {
  return /^sharzad-backup-[0-9-]+\.zip$/.test(name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}
