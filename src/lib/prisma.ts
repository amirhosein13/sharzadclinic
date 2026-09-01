import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * کوئری‌هایی که در زمان build اجرا می‌شوند نباید بیلد را بیندازند.
 * هنگام `docker build` یا CI معمولاً دیتابیس در دسترس نیست؛ در آن حالت
 * صفحه با داده‌ی خالی prerender می‌شود و در اولین revalidate پر می‌شود.
 */
export async function safeQuery<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (error) {
    console.warn(
      "[prisma] کوئری ناموفق بود؛ از مقدار جایگزین استفاده شد:",
      error instanceof Error ? error.message.split("\n")[0] : error
    );
    return fallback;
  }
}
