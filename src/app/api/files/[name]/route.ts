import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { PRIVATE_CONTENT_TYPES, PRIVATE_URL_PREFIX, privateFilePath } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const denied = () => new NextResponse("دسترسی ندارید.", { status: 403 });

/**
 * سرو کردن عکس‌های پرونده‌ی مشتری. این فایل‌ها بیرون از public ذخیره
 * می‌شوند و فقط پرسنلِ دارای دسترسیِ پرونده یا خودِ صاحبِ عکس می‌توانند
 * ببینندشان.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const path = privateFilePath(name);
  if (!path) return new NextResponse("یافت نشد.", { status: 404 });

  const staff = await getSession();
  if (!staff) {
    const customer = await getCustomerSession();
    if (!customer) return denied();

    const url = `${PRIVATE_URL_PREFIX}${name}`;
    const own = await prisma.treatmentRecord.findFirst({
      where: {
        customerId: customer.id,
        OR: [{ beforePhoto: url }, { afterPhoto: url }],
      },
      select: { id: true },
    });
    if (!own) return denied();
  }

  const buffer = await readFile(path).catch(() => null);
  if (!buffer) return new NextResponse("یافت نشد.", { status: 404 });

  const ext = name.split(".").pop()!.toLowerCase();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": PRIVATE_CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=0, no-store",
      "Content-Disposition": `inline; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
