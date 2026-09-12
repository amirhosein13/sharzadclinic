/**
 * ───────────────────────────────────────────────────────────────
 *  خواندن فایل .env برای اسکریپت‌هایی که خودشان اجرا می‌شوند
 * ───────────────────────────────────────────────────────────────
 *
 *  Next.js موقع اجرای سایت، .env را خودش می‌خواند. ولی یک اسکریپت
 *  مستقل که با tsx اجرا می‌شود این کار را نمی‌کند.
 *
 *  تا امروز اسکریپت‌ها این را «اتفاقی» درست داشتند: چون PrismaClient
 *  را import می‌کردند و پریزما به‌عنوان عارضه‌ی جانبی .env را بار
 *  می‌کند. هر اسکریپتی که به پریزما کار نداشت (مثل تست پیامک) بی‌صدا
 *  با متغیرهای خالی اجرا می‌شد و گزارش غلط می‌داد.
 *
 *  این فایل باید *اولین* import هر اسکریپت مستقل باشد.
 *
 *  عمداً از پکیج dotenv استفاده نشده: یک وابستگی تازه روی سروری که
 *  دسترسی‌اش به npm شکننده است، ارزشش را ندارد.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * یک خط .env را می‌شکند. اگر خط معتبر نبود null برمی‌گرداند.
 *
 * نکته‌ی مهم: # داخل گیومه بخشی از مقدار است، نه شروع توضیح. رمزهایی
 * که # دارند دقیقاً به همین دلیل نصفه خوانده می‌شدند.
 */
export function parseEnvLine(raw: string): [string, string] | null {
  const line = raw.trim();
  if (!line || line.startsWith("#")) return null;

  const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
  const eq = withoutExport.indexOf("=");
  if (eq <= 0) return null;

  const key = withoutExport.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = withoutExport.slice(eq + 1).trim();

  const quote = value[0];
  if (quote === '"' || quote === "'") {
    const end = value.lastIndexOf(quote);
    // گیومه‌ی بسته باید بعد از گیومه‌ی باز باشد، وگرنه گیومه‌ی تکی است
    if (end > 0) {
      value = value.slice(1, end);
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
      return [key, value];
    }
  }

  // بدون گیومه: هر چیزی بعد از « #» توضیح است
  const comment = value.search(/\s#/);
  if (comment >= 0) value = value.slice(0, comment);
  return [key, value.trim()];
}

export type EnvLoadResult = {
  loaded: number;
  /** کلیدهایی که بیش از یک بار در فایل آمده‌اند — مقدارِ اولی برنده است */
  duplicates: string[];
};

/**
 * .env را می‌خواند. متغیری که از قبل در محیط ست شده باشد دست‌نخورده
 * می‌ماند، تا بشود موقع تست از خط فرمان رویش را گرفت.
 *
 * کلید تکراری را گزارش می‌کند، چون تله‌ی بی‌صدایی است: وقتی کسی
 * تنظیمات تازه را ته فایل اضافه می‌کند در حالی که همان کلید بالاتر هم
 * هست، مقدارِ قدیمی برنده می‌شود و هیچ خطایی هم داده نمی‌شود.
 */
export function loadEnv(file = path.resolve(process.cwd(), ".env")): EnvLoadResult {
  if (!fs.existsSync(file)) return { loaded: 0, duplicates: [] };

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let loaded = 0;

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const pair = parseEnvLine(line);
    if (!pair) continue;
    const [key, value] = pair;

    if (seen.has(key)) duplicates.add(key);
    seen.add(key);

    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded++;
    }
  }
  return { loaded, duplicates: [...duplicates] };
}

export const envLoad = loadEnv();
