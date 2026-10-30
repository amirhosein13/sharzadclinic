import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { LEGACY_PUBLIC_DIR, PUBLIC_UPLOAD_DIR } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * سرو کردن تصاویری که مدیر آپلود می‌کند.
 *
 * چرا لازم است: `next start` فهرست پوشه‌ی public را *موقع بالا آمدن*
 * می‌خواند و بعد از آن دیگر به دیسک نگاه نمی‌کند. پس هر عکسی که بعد
 * از ری‌استارت آپلود شود، تا ری‌استارت بعدی ۴۰۴ می‌دهد — فایل روی
 * دیسک هست و سالم، ولی سایت نشانش نمی‌دهد.
 *
 * این دقیقاً همان چیزی بود که به‌شکل «عکس آپلود کردم، نیامد» دیده شد.
 *
 * چرا زیر /media و نه /uploads: اگر مسیر با پوشه‌ی public/uploads
 * یکی باشد، هندلرِ فایلِ ثابتِ نکست زودتر جواب می‌دهد و ۴۰۴ برمی‌گرداند
 * — به این هندلر اصلاً نمی‌رسد (تست شد). آدرس‌های قدیمیِ /uploads/...
 * که در دیتابیس ذخیره شده‌اند با یک rewrite در middleware به همین‌جا
 * می‌آیند، پس هیچ رکوردی لازم نیست عوض شود.
 */

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  // نام باید دقیقاً یک جزء باشد؛ اسلش یا «..» یعنی تلاش برای بیرون
  // رفتن از پوشه
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes("..")) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const type = CONTENT_TYPES[ext];
  if (!type) return new NextResponse(null, { status: 404 });

  // پوشه‌ی تازه اول؛ اگر نبود، جای قدیمی. این باعث می‌شود آدرس
  // /media/... برای عکس‌های قدیمی هم کار کند، نه فقط تازه‌ها.
  let file = "";
  let info: Awaited<ReturnType<typeof stat>> | null = null;
  for (const dir of [PUBLIC_UPLOAD_DIR, LEGACY_PUBLIC_DIR]) {
    try {
      const candidate = join(dir, name);
      const found = await stat(candidate);
      if (found.isFile()) {
        file = candidate;
        info = found;
        break;
      }
    } catch {
      // این پوشه ندارَدش؛ بعدی را امتحان کن
    }
  }
  if (!info) return new NextResponse(null, { status: 404 });

  try {

    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        // نام فایل تصادفی و تکرارنشدنی است، پس محتوا هیچ‌وقت عوض
        // نمی‌شود و می‌شود طولانی کش کرد
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
