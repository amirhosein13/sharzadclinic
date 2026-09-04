import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { searchEverything } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSession();
  // نتیجه‌ی جستجو پرونده‌ی مشتری است، پس همان دسترسی مشتریان لازم است
  if (!user || !can(user.role, "customers")) {
    return NextResponse.json({ hits: [] }, { status: 403 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const hits = await searchEverything(query);
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
}
