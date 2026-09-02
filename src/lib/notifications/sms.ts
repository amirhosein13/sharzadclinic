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
  send(to: string, message: string): Promise<SmsResult>;
  /** ارسال کد یکبارمصرف — در ایران باید از سرویس اختصاصی OTP استفاده شود */
  sendOtp(to: string, code: string): Promise<SmsResult>;
}

// ─── درایور توسعه: فقط در کنسول چاپ می‌کند ─────────────────────

const consoleDriver: SmsDriver = {
  name: "console",
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
      const res = await fetch(`${base}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, ...body }),
        cache: "no-store",
      });

      if (!res.ok) return { ok: false, error: `خطای ${res.status} از ملی پیامک` };

      const data = (await res.json()) as MeliResponse;
      const value = String(data.Value ?? "");
      // شناسه‌ی پیام یک عدد بلند است؛ کدهای خطا عددهای کوچک‌اند
      const looksLikeMessageId = /^\d{6,}$/.test(value);

      if (data.RetStatus === 1 || looksLikeMessageId) {
        return { ok: true, providerId: value || undefined };
      }
      return {
        ok: false,
        error: data.StrRetStatus || `ملی پیامک کد ${value || data.RetStatus} برگرداند`,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "ارتباط با ملی پیامک برقرار نشد",
      };
    }
  }

  return {
    name: "melipayamak",
    async send(to, message) {
      if (!sender) {
        return { ok: false, error: "شماره‌ی فرستنده (MELIPAYAMAK_SENDER) تنظیم نشده است." };
      }
      return call("SendSMS", { to, from: sender, text: message, isFlash: "false" });
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
