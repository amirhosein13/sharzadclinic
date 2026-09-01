import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";

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

  const result = await saveUpload(file);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
