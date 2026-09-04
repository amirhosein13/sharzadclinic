import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { normalizeCode } from "./discounts";
import { notifyReferralReward } from "./notifications";
import { formatToman, toFa } from "./utils";

/**
 * کد معرف.
 *
 * هر مشتری یک کد اختصاصی دارد. اگر کسی موقع رزرو آن کد را وارد کند، یک
 * «معرفی» ثبت می‌شود — ولی هدیه‌ای صادر نمی‌شود تا وقتی معرفی‌شده واقعاً
 * یک جلسه انجام دهد. با ثبت‌نام‌های الکی هیچ‌کس هدیه نمی‌گیرد.
 */

/** حروف بدون شباهت بصری — تا کسی «۰» و «O» را اشتباه نخواند */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(length = 5): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

/**
 * کد اختصاصی این مشتری. اگر نداشته باشد ساخته می‌شود.
 * برخورد کد عملاً غیرممکن است ولی به هر حال چند بار تلاش می‌کنیم.
 */
export async function ensureReferralCode(customerId: string): Promise<string> {
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `SH${randomSuffix()}`;
    try {
      const saved = await prisma.customer.update({
        where: { id: customerId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return saved.referralCode!;
    } catch {
      // کد تکراری — دوباره
    }
  }
  throw new Error("ساخت کد معرف ممکن نشد.");
}

export type ReferralAttach =
  | { ok: true; referrerName: string }
  | { ok: false; message: string };

/**
 * ثبت معرفی برای یک مشتریِ تازه.
 *
 * عمداً سخت‌گیر است: کد باید متعلق به کسی جز خودش باشد، مشتری نباید قبلاً
 * معرفی‌شده باشد، و نباید سابقه‌ی مراجعه داشته باشد — وگرنه مشتری قدیمی
 * می‌توانست با کد دوستش هدیه بگیرد.
 */
export async function attachReferral(options: {
  referredId: string;
  code: string;
}): Promise<ReferralAttach> {
  const settings = await getSettings();
  if (settings.referralEnabled !== "1") {
    return { ok: false, message: "کد معرف در حال حاضر فعال نیست." };
  }

  const code = normalizeCode(options.code);
  if (!code) return { ok: false, message: "کد معرف را وارد کنید." };

  const referrer = await prisma.customer.findUnique({
    where: { referralCode: code },
    select: { id: true, firstName: true, lastName: true, isBlocked: true },
  });
  if (!referrer || referrer.isBlocked) return { ok: false, message: "این کد معرف معتبر نیست." };
  if (referrer.id === options.referredId) {
    return { ok: false, message: "کد معرف خودتان را نمی‌توانید استفاده کنید." };
  }

  const already = await prisma.referral.findUnique({ where: { referredId: options.referredId } });
  if (already) return { ok: false, message: "برای شما قبلاً معرف ثبت شده است." };

  // فقط مراجع تازه — کسی که قبلاً آمده «معرفی‌شده» نیست
  const history = await prisma.appointment.count({
    where: { customerId: options.referredId, status: { in: ["DONE", "CONFIRMED"] } },
  });
  if (history > 0) {
    return { ok: false, message: "کد معرف فقط برای اولین مراجعه است." };
  }

  await prisma.referral.create({
    data: { referrerId: referrer.id, referredId: options.referredId },
  });

  return { ok: true, referrerName: `${referrer.firstName} ${referrer.lastName}` };
}

/** یک کد هدیه‌ی یک‌بارمصرف برای یک نفر مشخص */
async function issueGiftCode(amount: number, days: number, note: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `HEDIYE${randomSuffix(4)}`;
    try {
      await prisma.discountCode.create({
        data: {
          code,
          kind: "FIXED",
          value: amount,
          maxUses: 1,
          expiresAt: new Date(Date.now() + days * 86_400_000),
          note,
        },
      });
      return code;
    } catch {
      // کد تکراری — دوباره
    }
  }
  throw new Error("ساخت کد هدیه ممکن نشد.");
}

export type QualifyResult = { rewarded: number; skipped: number };

/**
 * معرفی‌هایی که معرفی‌شده‌شان اولین جلسه را انجام داده، هدیه می‌گیرند.
 *
 * هم بعد از «انجام شد» شدن نوبت صدا زده می‌شود، هم در کار شبانه — تا اگر
 * یک بار از قلم افتاد، شب جبران شود.
 */
export async function qualifyReferrals(): Promise<QualifyResult> {
  const settings = await getSettings();
  if (settings.referralEnabled !== "1") return { rewarded: 0, skipped: 0 };

  const referrerReward = Number(settings.referrerReward) || 0;
  const referredReward = Number(settings.referredReward) || 0;
  const days = Number(settings.referralRewardDays) || 90;
  if (referrerReward <= 0 && referredReward <= 0) return { rewarded: 0, skipped: 0 };

  const pending = await prisma.referral.findMany({
    where: {
      status: "PENDING",
      referred: { appointments: { some: { status: "DONE" } } },
    },
    include: {
      referrer: { select: { id: true, firstName: true, phone: true } },
      referred: { select: { id: true, firstName: true, phone: true } },
    },
    take: 100,
  });

  let rewarded = 0;
  let skipped = 0;

  for (const referral of pending) {
    try {
      const referrerCode =
        referrerReward > 0
          ? await issueGiftCode(referrerReward, days, `هدیه‌ی معرفی — ${referral.referrer.firstName}`)
          : null;
      const referredCode =
        referredReward > 0
          ? await issueGiftCode(referredReward, days, `هدیه‌ی خوش‌آمد — ${referral.referred.firstName}`)
          : null;

      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "REWARDED",
          referrerRewardCode: referrerCode,
          referredRewardCode: referredCode,
          rewardAmount: referrerReward,
          rewardedAt: new Date(),
        },
      });

      if (referrerCode) {
        await notifyReferralReward({
          phone: referral.referrer.phone,
          name: referral.referrer.firstName,
          code: referrerCode,
          amount: referrerReward,
          days,
          asReferrer: true,
        }).catch(() => undefined);
      }
      if (referredCode) {
        await notifyReferralReward({
          phone: referral.referred.phone,
          name: referral.referred.firstName,
          code: referredCode,
          amount: referredReward,
          days,
          asReferrer: false,
        }).catch(() => undefined);
      }

      rewarded++;
    } catch (error) {
      console.error("صدور هدیه‌ی معرفی ناموفق بود", error);
      skipped++;
    }
  }

  return { rewarded, skipped };
}

export type ReferralSummary = {
  code: string;
  total: number;
  pending: number;
  rewarded: number;
  earned: number;
  shareText: string;
};

/** خلاصه‌ی معرفی‌های یک مشتری، برای نمایش در پنل خودش */
export async function referralSummary(customerId: string): Promise<ReferralSummary | null> {
  const settings = await getSettings();
  if (settings.referralEnabled !== "1") return null;

  const code = await ensureReferralCode(customerId);
  const rows = await prisma.referral.findMany({
    where: { referrerId: customerId },
    select: { status: true, rewardAmount: true },
  });

  const rewarded = rows.filter((r) => r.status === "REWARDED");
  const referredReward = Number(settings.referredReward) || 0;

  return {
    code,
    total: rows.length,
    pending: rows.filter((r) => r.status === "PENDING").length,
    rewarded: rewarded.length,
    earned: rewarded.reduce((sum, r) => sum + (r.rewardAmount ?? 0), 0),
    shareText:
      referredReward > 0
        ? `سلام! ${settings.clinicName} را پیشنهاد می‌کنم. با کد معرف من «${code}» موقع رزرو، ${formatToman(referredReward)} هدیه می‌گیری.`
        : `سلام! ${settings.clinicName} را پیشنهاد می‌کنم. کد معرف من: ${code}`,
  };
}

export type TopReferrer = {
  id: string;
  name: string;
  phone: string;
  code: string | null;
  rewarded: number;
  pending: number;
};

/** معرف‌های برتر — برای اینکه مدیر بداند چه کسی واقعاً مشتری می‌آورد */
export async function topReferrers(limit = 20): Promise<TopReferrer[]> {
  const customers = await prisma.customer.findMany({
    where: { referralsMade: { some: {} } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      referralCode: true,
      referralsMade: { select: { status: true } },
    },
  });

  return customers
    .map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      phone: c.phone,
      code: c.referralCode,
      rewarded: c.referralsMade.filter((r) => r.status === "REWARDED").length,
      pending: c.referralsMade.filter((r) => r.status === "PENDING").length,
    }))
    .sort((a, b) => b.rewarded - a.rewarded || b.pending - a.pending)
    .slice(0, limit);
}

/** متن کوتاه برای نمایش وضعیت یک معرفی */
export function referralStatusLabel(status: string, pendingCount = 0): string {
  if (status === "REWARDED") return "هدیه صادر شد";
  if (status === "VOID") return "باطل شده";
  return pendingCount > 0 ? `${toFa(pendingCount)} در انتظار اولین جلسه` : "در انتظار اولین جلسه";
}
