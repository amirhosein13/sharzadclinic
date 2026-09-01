import "server-only";

/**
 * اتصال به درگاه پرداخت زرین‌پال (نسخه‌ی ۴ REST).
 *
 * حالت سندباکس با ZARINPAL_SANDBOX=true فعال می‌شود و بدون پول واقعی
 * می‌توان کل مسیر پرداخت را تست کرد.
 *
 * توجه: مبالغ در سایت به «تومان» نگهداری می‌شوند و زرین‌پال «ریال»
 * می‌گیرد، پس در مرز ارتباط با درگاه ضرب و تقسیم بر ۱۰ انجام می‌شود.
 */

const RIAL_PER_TOMAN = 10;

function config() {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID ?? "";
  const sandbox = process.env.ZARINPAL_SANDBOX === "true";
  const base = sandbox ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";
  return { merchantId, sandbox, base };
}

export function isZarinpalConfigured(): boolean {
  // شناسه‌ی پذیرنده‌ی زرین‌پال یک UUID سی‌وشش کاراکتری است
  return /^[0-9a-fA-F-]{36}$/.test(process.env.ZARINPAL_MERCHANT_ID ?? "");
}

export type RequestResult =
  | { ok: true; authority: string; redirectUrl: string }
  | { ok: false; message: string };

/** درخواست پرداخت — کد Authority و آدرس هدایت به درگاه را برمی‌گرداند */
export async function requestPayment(options: {
  /** مبلغ به تومان */
  amountToman: number;
  description: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
}): Promise<RequestResult> {
  const { merchantId, base } = config();
  if (!isZarinpalConfigured()) {
    return { ok: false, message: "درگاه پرداخت هنوز تنظیم نشده است." };
  }
  if (options.amountToman < 1000) {
    return { ok: false, message: "حداقل مبلغ قابل پرداخت ۱٬۰۰۰ تومان است." };
  }

  try {
    const res = await fetch(`${base}/pg/v4/payment/request.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: options.amountToman * RIAL_PER_TOMAN,
        description: options.description,
        callback_url: options.callbackUrl,
        metadata: {
          ...(options.mobile ? { mobile: options.mobile } : {}),
          ...(options.email ? { email: options.email } : {}),
        },
      }),
    });

    const json = (await res.json()) as {
      data?: { code: number; authority: string };
      errors?: { code: number; message: string } | unknown[];
    };

    if (json.data?.code === 100 && json.data.authority) {
      return {
        ok: true,
        authority: json.data.authority,
        redirectUrl: `${base}/pg/StartPay/${json.data.authority}`,
      };
    }

    const errors = json.errors;
    const message =
      errors && !Array.isArray(errors) && typeof errors === "object" && "message" in errors
        ? String((errors as { message: unknown }).message)
        : "درخواست پرداخت از سوی درگاه پذیرفته نشد.";
    return { ok: false, message };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `ارتباط با درگاه برقرار نشد: ${error.message}` : "ارتباط با درگاه برقرار نشد.",
    };
  }
}

export type VerifyResult =
  | { ok: true; refId: string; cardPan?: string; alreadyVerified: boolean }
  | { ok: false; message: string };

/** تأیید نهایی تراکنش پس از بازگشت از درگاه */
export async function verifyPayment(options: {
  authority: string;
  amountToman: number;
}): Promise<VerifyResult> {
  const { merchantId, base } = config();
  if (!isZarinpalConfigured()) {
    return { ok: false, message: "درگاه پرداخت تنظیم نشده است." };
  }

  try {
    const res = await fetch(`${base}/pg/v4/payment/verify.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: options.amountToman * RIAL_PER_TOMAN,
        authority: options.authority,
      }),
    });

    const json = (await res.json()) as {
      data?: { code: number; ref_id: number; card_pan?: string };
      errors?: { code: number; message: string } | unknown[];
    };

    // ۱۰۰ = تأیید موفق، ۱۰۱ = قبلاً تأیید شده
    if (json.data?.code === 100 || json.data?.code === 101) {
      return {
        ok: true,
        refId: String(json.data.ref_id),
        cardPan: json.data.card_pan,
        alreadyVerified: json.data.code === 101,
      };
    }

    const errors = json.errors;
    const message =
      errors && !Array.isArray(errors) && typeof errors === "object" && "message" in errors
        ? String((errors as { message: unknown }).message)
        : "تراکنش تأیید نشد.";
    return { ok: false, message };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `ارتباط با درگاه برقرار نشد: ${error.message}` : "ارتباط با درگاه برقرار نشد.",
    };
  }
}
