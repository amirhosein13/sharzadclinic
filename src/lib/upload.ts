import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/** تصاویر عمومی سایت (گالری، خدمات، مجله) — مستقیم از وب سرو می‌شوند */
const PUBLIC_DIR = join(process.cwd(), "public", "uploads");
/**
 * فایل‌های پرونده‌ی مشتری (عکس قبل/بعد). بیرون از public نگه داشته می‌شوند
 * تا با حدس زدن آدرس قابل دیدن نباشند؛ فقط از مسیر /api/files و پس از
 * بررسی دسترسی سرو می‌شوند.
 */
const PRIVATE_DIR = process.env.PRIVATE_UPLOAD_DIR
  ? join(process.env.PRIVATE_UPLOAD_DIR)
  : join(process.cwd(), "storage", "private");

const MAX_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

export type UploadVisibility = "public" | "private";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

/** امضای فایل را چک می‌کند تا کسی نتواند فایل غیرتصویری را با نوع جعلی آپلود کند */
function sniff(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP")
    return "webp";
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp" && buffer.subarray(8, 12).toString("ascii").startsWith("avif"))
    return "avif";
  const head = buffer.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "svg";
  return null;
}

export type UploadResult = { ok: true; url: string } | { ok: false; message: string };

/**
 * فایل آپلودشده را در public/uploads ذخیره و آدرس عمومی‌اش را برمی‌گرداند.
 * نام فایل تصادفی است تا نام اصلی نتواند مسیر را دستکاری کند.
 */
export async function saveUpload(
  file: File,
  visibility: UploadVisibility = "public",
): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, message: "فایلی انتخاب نشده است." };
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "حجم تصویر نباید بیشتر از ۵ مگابایت باشد." };
  }
  if (!ALLOWED[file.type]) {
    return { ok: false, message: "فقط تصویر با فرمت JPG، PNG، WebP، AVIF یا SVG مجاز است." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const actual = sniff(buffer);
  if (!actual || actual !== ALLOWED[file.type]) {
    return { ok: false, message: "محتوای فایل با فرمت اعلام‌شده هم‌خوانی ندارد." };
  }

  // SVG می‌تواند اسکریپت داشته باشد؛ در پرونده‌ی مشتری اصلاً لازم نیست
  if (visibility === "private" && actual === "svg") {
    return { ok: false, message: "برای عکس پرونده فقط JPG، PNG، WebP یا AVIF مجاز است." };
  }

  const dir = visibility === "private" ? PRIVATE_DIR : PUBLIC_DIR;
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${actual}`;
  await writeFile(join(dir, name), buffer);

  return {
    ok: true,
    url: visibility === "private" ? `${PRIVATE_URL_PREFIX}${name}` : `/uploads/${name}`,
  };
}

export const PRIVATE_URL_PREFIX = "/api/files/";

/** آیا این آدرس یک فایل خصوصیِ پرونده است؟ */
export function isPrivateUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith(PRIVATE_URL_PREFIX);
}

/**
 * مسیر فایل خصوصی روی دیسک. نام فایل سخت‌گیرانه بررسی می‌شود تا
 * با «..» یا اسلش نشود از پوشه بیرون رفت.
 */
export function privateFilePath(name: string): string | null {
  if (!/^[a-z0-9]+-[a-z0-9]+\.(jpg|png|webp|avif)$/i.test(name)) return null;
  return join(PRIVATE_DIR, name);
}

export const PRIVATE_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

/**
 * حذف فایل خصوصیِ بی‌استفاده (وقتی عکس عوض یا سابقه حذف می‌شود).
 * اگر فایل نبود بی‌سروصدا رد می‌شود — نباید جلوی ذخیره‌ی رکورد را بگیرد.
 */
export async function deletePrivateFile(url: string | null | undefined): Promise<void> {
  if (!isPrivateUrl(url)) return;
  const path = privateFilePath(url!.slice(PRIVATE_URL_PREFIX.length));
  if (!path) return;
  await unlink(path).catch(() => {});
}
