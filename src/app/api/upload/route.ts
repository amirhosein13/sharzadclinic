import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";
import { can } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, message: "دسترسی ندارید." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "فایلی ارسال نشده است." }, { status: 400 });
  }

  const isPrivate = formData?.get("scope") === "private";
  // عکس پرونده را منشی هم آپلود می‌کند، ولی تصویر عمومی سایت فقط با دسترسی محتوا
  const permission = isPrivate ? "customers.write" : "content";
  if (!can(user.role, permission)) {
    return NextResponse.json({ ok: false, message: "دسترسی ندارید." }, { status: 403 });
  }

  // بدون این try، هر خطای دیسک (مثلاً پوشه‌ی آپلود که برای کاربر
  // برنامه قابل نوشتن نیست) یک صفحه‌ی ۵۰۰ HTML می‌شود؛ آن‌وقت
  // res.json() سمت مرورگر می‌شکند و کاربر «ارتباط با سرور برقرار
  // نشد» می‌بیند — که به شبکه اشاره می‌کند و هیچ ربطی به ماجرا
  // ندارد. نتیجه: آپلود بی‌صدا کار نمی‌کند و هیچ‌کس نمی‌فهمد چرا.
  try {
    const result = await saveUpload(file, isPrivate ? "private" : "public");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[upload] ذخیره‌ی فایل شکست خورد:", error);

    const code = (error as { code?: string })?.code;
    const message =
      code === "EACCES" || code === "EPERM"
        ? "سرور اجازه‌ی نوشتن در پوشه‌ی تصاویر را ندارد. در «سلامت سیستم» راه حلش نوشته شده."
        : code === "ENOSPC"
          ? "فضای دیسک سرور پر شده است."
          : "ذخیره‌ی تصویر روی سرور ممکن نشد.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
