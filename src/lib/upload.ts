import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

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
export async function saveUpload(file: File): Promise<UploadResult> {
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

  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${actual}`;
  await writeFile(join(UPLOAD_DIR, name), buffer);

  return { ok: true, url: `/uploads/${name}` };
}
