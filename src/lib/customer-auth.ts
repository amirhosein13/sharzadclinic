import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "./prisma";
import { normalizePhone, toFa } from "./utils";

const COOKIE_NAME = "sharzad_customer";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // ۳۰ روز
const OTP_TTL_MINUTES = 3;
const MAX_ATTEMPTS = 5;
/** حداکثر درخواست کد در بازه‌ی زیر */
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_MINUTES = 10;

export type CustomerSession = { id: string; phone: string; name: string };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET تنظیم نشده است.");
  return new TextEncoder().encode(secret);
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export type OtpRequest =
  | { ok: true; expiresInSeconds: number; devCode?: string }
  | { ok: false; message: string };

/**
 * کد یکبارمصرف می‌سازد و ذخیره می‌کند.
 * کد فقط به‌صورت هش نگهداری می‌شود و هیچ‌جا در دیتابیس به‌صورت خام نمی‌ماند.
 */
export async function issueOtp(rawPhone: string): Promise<OtpRequest & { code?: string }> {
  const phone = normalizePhone(rawPhone);

  const since = new Date(Date.now() - RATE_LIMIT_MINUTES * 60_000);
  const recent = await prisma.otpCode.count({ where: { phone, createdAt: { gte: since } } });
  if (recent >= RATE_LIMIT_COUNT) {
    return {
      ok: false,
      message: `تعداد درخواست‌ها زیاد است. لطفاً ${toFa(RATE_LIMIT_MINUTES)} دقیقه‌ی دیگر دوباره تلاش کنید.`,
    };
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  // کدهای قبلیِ مصرف‌نشده باطل می‌شوند
  await prisma.otpCode.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: { phone, codeHash: await bcrypt.hash(code, 10), expiresAt },
  });

  return { ok: true, expiresInSeconds: OTP_TTL_MINUTES * 60, code };
}

export type OtpVerify =
  | { ok: true; customer: CustomerSession }
  | { ok: false; message: string };

export async function verifyOtp(rawPhone: string, rawCode: string): Promise<OtpVerify> {
  const phone = normalizePhone(rawPhone);
  const code = rawCode.trim();

  const record = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, message: "کدی برای این شماره صادر نشده. دوباره درخواست کنید." };
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

  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) {
    return {
      ok: false,
      message: "با این شماره سابقه‌ای در کلینیک ثبت نشده است. ابتدا یک نوبت رزرو کنید.",
    };
  }
  if (customer.isBlocked) {
    return { ok: false, message: "دسترسی این شماره محدود شده است. لطفاً تماس بگیرید." };
  }

  return {
    ok: true,
    customer: {
      id: customer.id,
      phone: customer.phone,
      name: `${customer.firstName} ${customer.lastName}`,
    },
  };
}

export async function createCustomerSession(customer: CustomerSession): Promise<void> {
  const token = await new SignJWT({ ...customer })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customer.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  // خارج از یک درخواست (مثلاً در اسکریپت‌ها) کوکی در دسترس نیست
  let token: string | undefined;
  try {
    token = (await cookies()).get(COOKIE_NAME)?.value;
  } catch {
    return null;
  }
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      id: String(payload.id),
      phone: String(payload.phone),
      name: String(payload.name),
    };
  } catch {
    return null;
  }
}

export const CUSTOMER_COOKIE = COOKIE_NAME;
