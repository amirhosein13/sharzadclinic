import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  const dateKey = searchParams.get("date");
  const staffId = searchParams.get("staffId");

  if (!serviceId || !dateKey) {
    return NextResponse.json({ error: "پارامترهای لازم ارسال نشده" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ error: "قالب تاریخ نامعتبر است" }, { status: 400 });
  }

  try {
    const slots = await getAvailableSlots({ serviceId, dateKey, staffId: staffId || null });
    return NextResponse.json(
      { slots },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "خطا در دریافت نوبت‌ها" }, { status: 500 });
  }
}
