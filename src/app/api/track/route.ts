import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/site-stats";

/**
 * ثبت رویداد آمار سایت.
 *
 * عمداً هیچ چیزی از بازدیدکننده ذخیره نمی‌شود — نه IP، نه کوکی، نه شناسه.
 * فقط «یک نفر این صفحه را دید» یا «یک نفر تا این مرحله‌ی رزرو آمد».
 * پاسخ همیشه ۲۰۴ است تا هیچ‌وقت خطایی به کاربر نشان داده نشود.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = typeof body?.kind === "string" ? body.kind : "";
    const slug = typeof body?.slug === "string" ? body.slug : null;
    // اعتبارسنجی داخل trackEvent است؛ هرچه ناشناخته باشد بی‌سروصدا دور ریخته می‌شود
    await trackEvent(kind, slug);
  } catch {
    // آمار هیچ‌وقت نباید به کاربر خطا نشان بدهد
  }
  return new NextResponse(null, { status: 204 });
}
