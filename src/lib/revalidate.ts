import "server-only";
import { revalidatePath } from "next/cache";

/**
 * بازتازه‌سازی کش، بدون اینکه بتواند نتیجه‌ی یک اکشن را خراب کند.
 * خارج از یک درخواست (اسکریپت‌ها، تست‌ها) `revalidatePath` خطا می‌دهد؛
 * اگر داخل try اصلی باشد، کاربری که کارش با موفقیت انجام شده پیام «خطا»
 * می‌گیرد. این تابع جلوی آن را می‌گیرد.
 */
export function safeRevalidate(...paths: string[]): void {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // خارج از یک درخواست، کشی برای تازه‌کردن وجود ندارد
    }
  }
}
