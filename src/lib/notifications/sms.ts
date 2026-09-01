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

// ─── انتخاب درایور بر اساس تنظیمات ─────────────────────────────

let cached: SmsDriver | null = null;

export function getSmsDriver(): SmsDriver {
  if (cached) return cached;

  const provider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();

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
