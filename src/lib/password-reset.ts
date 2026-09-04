import "server-only";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "./prisma";
import { normalizePhone, toFa } from "./utils";
import { clearLoginAttempts } from "./login-guard";

const PURPOSE = "password-reset";
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** حداکثر درخواست کد در بازه‌ی زیر */
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_MINUTES = 15;

/**
 * پاسخ یکسان برای «ایمیل وجود ندارد» و «ایمیل وجود دارد» — وگرنه این صفحه
 * تبدیل می‌شود به ابزار فهرست‌کردن حساب‌های پنل.
 */
export const NEUTRAL_MESSAGE =
  "اگر این ایمیل در سیستم باشد و برایش موبایل ثبت شده باشد، کد بازیابی پیامک می‌شود.";

export type ResetRequest =
  | { ok: true; maskedPhone: string | null; code?: string }
  | { ok: false; message: string };

/** ۰۹۱۲۳۴۵۶۷۸۹ ← ۰۹۱۲***۶۷۸۹ — آن‌قدر که بفهمی کدام خط، نه آن‌قدر که لو برود */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return "***";
  return toFa(`${phone.slice(0, 4)}***${phone.slice(-4)}`);
}

/**
 * کد بازیابی می‌سازد و برمی‌گرداند. کد فقط هش‌شده ذخیره می‌شود.
 * اگر کاربر نبود یا موبایل نداشت، `maskedPhone` خالی برمی‌گردد ولی نتیجه
 * همچنان ok است تا از بیرون تفاوتی دیده نشود.
 */
export async function issueResetCode(rawEmail: string): Promise<ResetRequest> {
  const email = rawEmail.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, phone: true, isActive: true },
  });

  if (!user || !user.isActive || !user.phone) return { ok: true, maskedPhone: null };

  const phone = normalizePhone(user.phone);
  const since = new Date(Date.now() - RATE_LIMIT_MINUTES * 60_000);
  const recent = await prisma.otpCode.count({
    where: { phone, purpose: PURPOSE, createdAt: { gte: since } },
  });
  if (recent >= RATE_LIMIT_COUNT) {
    return {
      ok: false,
      message: `تعداد درخواست‌ها زیاد است. ${toFa(RATE_LIMIT_MINUTES)} دقیقه‌ی دیگر دوباره تلاش کنید.`,
    };
  }

  const code = String(randomInt(100000, 1000000));

  // کدهای قبلیِ همین منظور باطل می‌شوند تا فقط آخرین کد کار کند
  await prisma.otpCode.updateMany({
    where: { phone, purpose: PURPOSE, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: {
      phone,
      purpose: PURPOSE,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
    },
  });

  return { ok: true, maskedPhone: maskPhone(phone), code };
}

export type ResetResult = { ok: true } | { ok: false; message: string };

/** کد را می‌سنجد و در صورت درستی رمز تازه را می‌نشاند. */
export async function resetPasswordWithCode(
  rawEmail: string,
  rawCode: string,
  newPassword: string,
): Promise<ResetResult> {
  const email = rawEmail.toLowerCase().trim();
  const code = rawCode.trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, phone: true, isActive: true },
  });
  // پیام یکسان با «کد اشتباه» تا نبودِ حساب از این‌جا هم لو نرود
  if (!user || !user.isActive || !user.phone) {
    return { ok: false, message: "کد اشتباه یا منقضی است." };
  }

  const phone = normalizePhone(user.phone);
  const record = await prisma.otpCode.findFirst({
    where: { phone, purpose: PURPOSE, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, message: "کدی صادر نشده است. دوباره درخواست کنید." };
  if (record.expiresAt < new Date()) {
    return { ok: false, message: "کد منقضی شده است. کد جدید بگیرید." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return { ok: false, message: "تعداد تلاش‌های ناموفق زیاد شد. کد جدید بگیرید." };
  }

  if (!(await bcrypt.compare(code, record.codeHash))) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - record.attempts - 1;
    return {
      ok: false,
      message: left > 0 ? `کد اشتباه است. ${toFa(left)} تلاش دیگر باقی مانده.` : "کد اشتباه است.",
    };
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });
  // کسی که رمزش را فراموش کرده حتماً چند بار اشتباه زده؛ قفل باید برداشته شود
  await clearLoginAttempts(email);

  return { ok: true };
}
