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

  const result = await saveUpload(file, isPrivate ? "private" : "public");
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
