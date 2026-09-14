import "server-only";
import { normalizePhone } from "../utils";

export type SmsResult = {
  ok: boolean;
  providerId?: string;
  error?: string;
  /** در حالت console پیام واقعاً ارسال نشده و فقط چاپ شده است */
  simulated?: boolean;
};

export interface SmsDriver {
  readonly name: string;
  /**
   * آیا سرویسِ اختصاصیِ کد یکبارمصرف در دسترس است؟
   *
   * در ملی پیامک این سرویس («خدمات پایه») روی پنل رایگان نیست. اگر
   * نباشد، کد را به‌شکل پیامک معمولی از خط اختصاصی می‌فرستیم — خودِ
   * کد را که ما می‌سازیم، «خدمات پایه» فقط یکی از راه‌های فرستادنش
   * است. این پرچم می‌گوید کدام راه باز است.
   */
  readonly otpReady: boolean;
  send(to: string, message: string): Promise<SmsResult>;
  /** ارسال کد یکبارمصرف — در ایران باید از سرویس اختصاصی OTP استفاده شود */
  sendOtp(to: string, code: string): Promise<SmsResult>;
}

// ─── درایور توسعه: فقط در کنسول چاپ می‌کند ─────────────────────

const consoleDriver: SmsDriver = {
  name: "console",
  otpReady: true,
  async send(to, message) {
    console.log(`\n📱 [پیامک شبیه‌سازی‌شده] به ${to}\n${message}\n`);
    return { ok: true, simulated: true, providerId: `console-${Date.now()}` };
  },
  async sendOtp(to, code) {
    console.log(`\n🔑 [کد ورود شبیه‌سازی‌شده] برای ${to} → ${code}\n`);
    return { ok: true, simulated: true, providerId: `console-${Date.now()}` };
  },
};

// ─── کاوه‌نگار ─────────────────────────────────────────────────

function kavenegarDriver(apiKey: string, sender: string, otpTemplate: string): SmsDriver {
  const base = `https://api.kavenegar.com/v1/${apiKey}`;

  async function call(url: string): Promise<SmsResult> {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as {
        return?: { status: number; message: string };
        entries?: { messageid: number }[] | null;
      };

      if (data.return?.status !== 200) {
        return { ok: false, error: data.return?.message ?? `خطای ${res.status} از کاوه‌نگار` };
      }
      return { ok: true, providerId: data.entries?.[0]?.messageid?.toString() };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "ارتباط با کاوه‌نگار برقرار نشد" };
    }
  }

  return {
    name: "kavenegar",
    otpReady: !!otpTemplate,
    async send(to, message) {
      const params = new URLSearchParams({ receptor: to, sender, message });
      return call(`${base}/sms/send.json?${params}`);
    },
    async sendOtp(to, code) {
      if (!otpTemplate) {
        return { ok: false, error: "الگوی OTP کاوه‌نگار (KAVENEGAR_OTP_TEMPLATE) تنظیم نشده است." };
      }
      const params = new URLSearchParams({ receptor: to, token: code, template: otpTemplate });
      return call(`${base}/verify/lookup.json?${params}`);
    },
  };
}

// ─── ملی پیامک ─────────────────────────────────────────────────

/**
 * REST API ملی پیامک (rest.payamak-panel.com) — همان چیزی که SDK رسمی
 * خودشان استفاده می‌کند. با نام کاربری و رمز پنل کار می‌کند، نه توکن.
 *
 * پاسخ به شکل { Value, RetStatus, StrRetStatus } برمی‌گردد؛ در موفقیت
 * RetStatus برابر ۱ و Value شناسه‌ی پیام است. اگر روزی قالب پاسخ عوض شد،
 * شناسه‌ی عددیِ بلند در Value هم به‌عنوان موفقیت پذیرفته می‌شود.
 */
/**
 * کدهای خطای ملی پیامک، از سند رسمی «راهنمای وب سرویس ارسال Rest».
 *
 * بدون این جدول، خطا به‌شکل «ملی پیامک کد ۱۴ برگرداند» در لاگ می‌نشیند
 * و هیچ‌کس نمی‌فهمد باید چه کند. هر پیام عمداً می‌گوید «چه کن»، نه فقط
 * «چه شد».
 */
const MELI_ERRORS: Record<string, string> = {
  "-111": "IP سرور از نظر ملی پیامک نامعتبر است. در پنل → تنظیمات وبسرویس، IP سرور را در فهرست مجاز اضافه کن.",
  "-110": "ملی پیامک اجازه نمی‌دهد رمز پنل بفرستی. به‌جای رمز، APIKey را در MELIPAYAMAK_PASSWORD بگذار.",
  "-109": "ملی پیامک الزام کرده IP مجاز تنظیم شود. در پنل → تنظیمات وبسرویس، IP سرور را اضافه کن.",
  "-108": "IP سرور به‌دلیل تلاش‌های ناموفق مسدود شده. با پشتیبانی ملی پیامک تماس بگیر.",
  "0": "نام کاربری یا رمز اشتباه است. MELIPAYAMAK_USERNAME و APIKey را چک کن.",
  "2": "اعتبار پیامک تمام شده. پنل ملی پیامک را شارژ کن.",
  "3": "به محدودیت ارسال روزانه خورده‌ای.",
  "4": "به محدودیت حجم ارسال خورده‌ای.",
  "5": "شماره فرستنده معتبر نیست. MELIPAYAMAK_SENDER را با شماره‌ی خط اختصاصی‌ات مقایسه کن.",
  "6": "سامانه‌ی ملی پیامک در حال بروزرسانی است. بعداً دوباره تلاش کن.",
  "7": "متن پیامک کلمه‌ی فیلترشده دارد.",
  "9": "از خطوط عمومی نمی‌شود با وب‌سرویس ارسال کرد؛ خط اختصاصی لازم است.",
  "10": "حساب کاربری در ملی پیامک فعال نیست.",
  "11": "ملی پیامک پیام را نپذیرفت (کد ۱۱ — «ارسال نشده»). معمولاً یعنی خط فرستنده برای این حساب مجاز نیست، اعتبار صفر است، یا خط هنوز تأیید نشده. اعتبار و فهرست خطوط را با npm run sms:test ببین.",
  "12": "مدارک حساب در ملی پیامک کامل نیست.",
  "14": "متن پیامک لینک دارد و ملی پیامک لینک را رد می‌کند. برای ارسال لینک باید از پنل ملی پیامک مجوز بگیری.",
  "15": "ملی پیامک «لغو۱۱» در انتهای متن می‌خواهد (مخصوص پیامک تبلیغاتی).",
  "16": "شماره گیرنده پیدا نشد.",
  "17": "متن پیامک خالی است.",
  "18": "شماره موبایل گیرنده معتبر نیست.",
};

/** پیام خطای خوانا برای کدی که ملی پیامک برگردانده */
export function meliErrorMessage(code: string, fallback?: string): string {
  const known = MELI_ERRORS[code.trim()];
  if (known) return known;
  return fallback?.trim() || `ملی پیامک کد ${code} برگرداند (در سند رسمی‌اش معنی‌اش را ببین).`;
}

function meliPayamakDriver(
  username: string,
  password: string,
  sender: string,
  otpBodyId: string,
): SmsDriver {
  const base = "https://rest.payamak-panel.com/api/SendSMS";

  type MeliResponse = { Value?: string | number; RetStatus?: number; StrRetStatus?: string };

  async function call(path: string, body: Record<string, string>): Promise<SmsResult> {
    try {
      // نمونه‌های رسمی ملی پیامک (همه‌شان، از SendSMS تا BaseServiceNumber)
      // از x-www-form-urlencoded استفاده می‌کنند، نه JSON. ما JSON
      // می‌فرستادیم و ارسال با کد ۱۱ («ارسال نشده») رد می‌شد، در حالی که
      // متدهای خواندنی مثل GetCredit با همان JSON جواب می‌دادند — که
      // گمراه‌کننده بود و باعث شد دنبال اعتبار و خط فرستنده بگردیم.
      const res = await fetch(`${base}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password, ...body }).toString(),
        cache: "no-store",
      });

      if (!res.ok) return { ok: false, error: `خطای ${res.status} از ملی پیامک` };

      const data = (await res.json()) as MeliResponse;
      const value = String(data.Value ?? "").trim();

      // نکته‌ی حیاتی: RetStatus=1 یعنی «درخواست پردازش شد»، نه «پیامک
      // رفت». وضعیتِ واقعی ارسال در Value است — طبق سند رسمی، در
      // موفقیت RecID (یک عدد بلند، یا چند تا با کاما) و در شکست کدِ
      // خطا. قبلاً به RetStatus اعتماد می‌کردیم و «Value: 11» یعنی
      // «ارسال نشده» را موفق گزارش می‌کردیم.
      const parts = value.split(",").map((v) => v.trim()).filter(Boolean);
      const looksLikeRecId = parts.length > 0 && parts.every((v) => /^\d{6,}$/.test(v));

      if (looksLikeRecId) return { ok: true, providerId: value };

      // Value خالی با RetStatus=1: اطلاعات بهتری نداریم، موفق می‌گیریم
      if (!value && data.RetStatus === 1) return { ok: true };

      const code = value || String(data.RetStatus ?? "");
      return { ok: false, error: meliErrorMessage(code, data.StrRetStatus) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "ارتباط با ملی پیامک برقرار نشد",
      };
    }
  }

  return {
    name: "melipayamak",
    otpReady: !!otpBodyId,
    async send(to, message) {
      if (!sender) {
        return { ok: false, error: "شماره‌ی فرستنده (MELIPAYAMAK_SENDER) تنظیم نشده است." };
      }
      return call("SendSMS", { to, from: sender, text: message, isflash: "false" });
    },
    async sendOtp(to, code) {
      if (!otpBodyId) {
        return {
          ok: false,
          error: "شناسه‌ی الگوی خدمات پایه (MELIPAYAMAK_OTP_BODY_ID) تنظیم نشده است.",
        };
      }
      // در «خدمات پایه»، text همان مقداری است که جای متغیر الگو می‌نشیند
      return call("BaseServiceNumber", { to, text: code, bodyId: otpBodyId });
    },
  };
}

/**
 * وضعیت حساب ملی پیامک: اعتبار و فهرست خطوط اختصاصی.
 *
 * وقتی ارسال با کد ۱۱ («ارسال نشده») رد می‌شود، خودِ کد نمی‌گوید چرا.
 * این دو متد — که در همان سند رسمی هستند — معمولاً جواب را می‌دهند:
 * یا اعتبار صفر است، یا شماره‌ای که در MELIPAYAMAK_SENDER گذاشته‌ایم
 * اصلاً جزو خطوط این حساب نیست.
 */
export async function meliAccountInfo(): Promise<{
  /** موجودی به تعداد پیامک (GetCredit) */
  credit?: string;
  /** موجودی ریالی (GetCredit2) — برای تفکیک «۱۳۶ پیامک» از «۱۳۶ ریال» */
  rials?: string;
  numbers?: string[];
  error?: string;
}> {
  const username = process.env.MELIPAYAMAK_USERNAME;
  const password = process.env.MELIPAYAMAK_PASSWORD;
  if (!username || !password) return { error: "نام کاربری یا کلید تنظیم نشده" };

  // بدنه یک بار ساخته می‌شود؛ داخل کلوزر، باریک‌سازی تایپ حفظ نمی‌شود
  const credentials = new URLSearchParams({ username, password }).toString();

  async function post(path: string) {
    const res = await fetch(`https://rest.payamak-panel.com/api/SendSMS/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: credentials,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`خطای ${res.status}`);
    return res.json();
  }

  try {
    const [creditRes, rialRes, numbersRes] = await Promise.all([
      post("GetCredit").catch(() => null),
      post("GetCredit2").catch(() => null),
      post("GetUserNumbers").catch(() => null),
    ]);

    const credit = creditRes?.Value != null ? String(creditRes.Value) : undefined;
    const rials = rialRes?.Value != null ? String(rialRes.Value) : undefined;

    // GetUserNumbers پاسخ تودرتو دارد: { MyBase: {...}, Data: [{Number}] }
    const rows: unknown = numbersRes?.Data;
    const numbers = Array.isArray(rows)
      ? rows
          .map((r) => (r && typeof r === "object" ? String((r as { Number?: string }).Number ?? "") : ""))
          .filter(Boolean)
      : undefined;

    return { credit, rials, numbers };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ارتباط برقرار نشد" };
  }
}

// ─── انتخاب درایور بر اساس تنظیمات ─────────────────────────────

let cached: SmsDriver | null = null;

export function getSmsDriver(): SmsDriver {
  if (cached) return cached;

  const provider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();

  if (provider === "melipayamak" || provider === "meli") {
    const username = process.env.MELIPAYAMAK_USERNAME;
    const password = process.env.MELIPAYAMAK_PASSWORD;
    if (!username || !password) {
      console.warn(
        "⚠️ SMS_PROVIDER=melipayamak است اما MELIPAYAMAK_USERNAME/PASSWORD تنظیم نشده — به حالت کنسول برمی‌گردیم.",
      );
      cached = consoleDriver;
      return cached;
    }
    cached = meliPayamakDriver(
      username,
      password,
      process.env.MELIPAYAMAK_SENDER ?? "",
      process.env.MELIPAYAMAK_OTP_BODY_ID ?? "",
    );
    return cached;
  }

  if (provider === "kavenegar") {
    const apiKey = process.env.KAVENEGAR_API_KEY;
    const sender = process.env.KAVENEGAR_SENDER ?? "";
    if (!apiKey) {
      console.warn("⚠️ SMS_PROVIDER=kavenegar است اما KAVENEGAR_API_KEY تنظیم نشده — به حالت کنسول برمی‌گردیم.");
      cached = consoleDriver;
      return cached;
    }
    cached = kavenegarDriver(apiKey, sender, process.env.KAVENEGAR_OTP_TEMPLATE ?? "");
    return cached;
  }

  cached = consoleDriver;
  return cached;
}

/** شماره را به قالبی که سرویس‌های ایرانی می‌پذیرند تبدیل می‌کند */
export function smsRecipient(raw: string): string {
  return normalizePhone(raw);
}
