import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getSession, logAction } from "@/lib/auth";
import { BACKUP_DIR, createBackup, isSafeBackupName, pruneBackups } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// ساخت پشتیبان از کل دیتابیس و فایل‌ها می‌تواند طول بکشد
export const maxDuration = 300;

function download(path: string, filename: string, bytes: number) {
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(bytes),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * دانلود پشتیبان توسط مدیر. بدون پارامتر یک پشتیبان تازه می‌سازد؛
 * با ?file=... یکی از پشتیبان‌های موجود روی سرور را می‌دهد.
 */
export async function GET(request: Request) {
  const user = await getSession();
  // پشتیبان شامل کل پرونده‌های پزشکی است — فقط مدیر کل
  if (!user || user.role !== "ADMIN") {
    return new NextResponse("دسترسی ندارید.", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const requested = params.get("file");

  if (requested) {
    if (!isSafeBackupName(requested)) return new NextResponse("یافت نشد.", { status: 404 });
    const path = join(BACKUP_DIR, requested);
    const info = await stat(path).catch(() => null);
    if (!info) return new NextResponse("یافت نشد.", { status: 404 });

    await logAction({ userId: user.id, action: "backup.download", entity: "Backup", entityId: requested });
    return download(path, requested, info.size);
  }

  const includeFiles = params.get("files") !== "0";
  const result = await createBackup({ includeFiles });
  await pruneBackups();

  await logAction({
    userId: user.id,
    action: "backup.create",
    entity: "Backup",
    entityId: result.filename,
    detail: `${result.bytes} بایت`,
  });

  return download(result.path, result.filename, result.bytes);
}
