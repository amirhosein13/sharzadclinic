import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import { toFa } from "./utils";

/** بعد از این تعداد تلاش ناموفق، ورود موقتاً قفل می‌شود */
export const MAX_ATTEMPTS = 5;
/** طول پنجره‌ی شمارش و مدت قفل، به دقیقه */
export const WINDOW_MINUTES = 15;

const FAILED = "login.failed";
const SUCCESS = "login";

/** IP کاربر، تا حمله‌ی توزیع‌شده روی چند ایمیل هم دیده شود */
export async function clientIp(): Promise<string> {
  try {
    const list = await headers();
    const forwarded = list.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]!.trim();
    return list.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

export type LoginGate =
  | { allowed: true }
  | { allowed: false; message: string; retryAfterMinutes: number };

/**
 * آیا این ایمیل اجازه‌ی تلاش دوباره دارد؟
 *
 * تلاش‌های ناموفق فقط از آخرین ورود موفق به بعد شمرده می‌شوند، تا کسی که
 * چند بار اشتباه زده ولی بعدش درست وارد شده، دفعه‌ی بعد بی‌دلیل قفل نشود.
 */
export async function checkLoginAllowed(email: string): Promise<LoginGate> {
  const key = email.toLowerCase().trim();
  if (!key) return { allowed: true };

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000);

  const lastSuccess = await prisma.auditLog.findFirst({
    where: { action: SUCCESS, detail: key, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const since = lastSuccess?.createdAt ?? windowStart;
  const failures = await prisma.auditLog.findMany({
    where: { action: FAILED, detail: key, createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (failures.length < MAX_ATTEMPTS) return { allowed: true };

  // قفل از زمان اولین تلاشِ همین دسته شروع می‌شود
  const unlockAt = new Date(failures[0].createdAt.getTime() + WINDOW_MINUTES * 60_000);
  const remaining = Math.max(1, Math.ceil((unlockAt.getTime() - Date.now()) / 60_000));

  return {
    allowed: false,
    retryAfterMinutes: remaining,
    message: `به‌خاطر چند تلاش ناموفق، ورود موقتاً بسته شده است. ${toFa(remaining)} دقیقه‌ی دیگر دوباره امتحان کنید.`,
  };
}

export async function recordFailedLogin(email: string): Promise<void> {
  const key = email.toLowerCase().trim();
  await prisma.auditLog
    .create({
      data: {
        action: FAILED,
        entity: "User",
        // ایمیل در detail می‌نشیند تا هم شمارش شود هم در گزارش دیده شود
        detail: key,
        entityId: await clientIp(),
      },
    })
    .catch(() => undefined);
}

/**
 * قفل ورود این ایمیل را برمی‌دارد.
 *
 * بعد از بازیابی رمز لازم است: کسی که رمزش را فراموش کرده حتماً چند بار
 * اشتباه زده، و اگر قفل بماند با رمز تازه‌اش هم نمی‌تواند وارد شود.
 */
export async function clearLoginAttempts(email: string): Promise<void> {
  const key = email.toLowerCase().trim();
  if (!key) return;
  await prisma.auditLog
    .deleteMany({ where: { action: FAILED, detail: key } })
    .catch(() => undefined);
}

/** چند تلاش ناموفق تازه داشته‌ایم؟ برای نمایش در گزارش امنیتی */
export async function recentFailedLogins(hours = 24): Promise<number> {
  return prisma.auditLog.count({
    where: { action: FAILED, createdAt: { gte: new Date(Date.now() - hours * 3600_000) } },
  });
}
