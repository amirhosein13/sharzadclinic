import "server-only";
import { prisma } from "./prisma";
import { formatToman, toEn, toFa } from "./utils";

export type DiscountCheck =
  | {
      ok: true;
      codeId: string;
      code: string;
      /** مبلغ تخفیف به تومان */
      discount: number;
      /** مبلغ نهایی پس از تخفیف */
      finalAmount: number;
      label: string;
    }
  | { ok: false; message: string };

/** کد تخفیف را یکدست می‌کند: انگلیسی، بدون فاصله، حروف بزرگ */
export function normalizeCode(input: string): string {
  return toEn(input).trim().toUpperCase().replaceAll(/\s+/g, "");
}

/**
 * بررسی اعتبار کد برای یک مبلغ مشخص. هیچ چیزی را ثبت نمی‌کند —
 * ثبت مصرف با `redeemDiscount` و پس از قطعی‌شدن پرداخت انجام می‌شود.
 */
export async function checkDiscount(opts: {
  code: string;
  amount: number;
  customerId?: string | null;
}): Promise<DiscountCheck> {
  const code = normalizeCode(opts.code);
  if (!code) return { ok: false, message: "کد تخفیف را وارد کنید." };

  const row = await prisma.discountCode.findUnique({ where: { code } });
  if (!row || !row.isActive) return { ok: false, message: "این کد تخفیف معتبر نیست." };

  const now = new Date();
  if (row.startsAt && row.startsAt > now) return { ok: false, message: "این کد هنوز فعال نشده است." };
  if (row.expiresAt && row.expiresAt < now) return { ok: false, message: "مهلت این کد تخفیف تمام شده است." };
  if (row.minAmount !== null && opts.amount < row.minAmount) {
    return { ok: false, message: `این کد برای خریدهای بالای ${formatToman(row.minAmount)} است.` };
  }

  if (opts.customerId) {
    const used = await prisma.discountUse.findFirst({
      where: { codeId: row.id, customerId: opts.customerId },
      select: { id: true },
    });
    if (used) return { ok: false, message: "شما قبلاً از این کد استفاده کرده‌اید." };
  }

  if (row.maxUses !== null && row.usedCount >= row.maxUses) {
    return { ok: false, message: "ظرفیت استفاده از این کد تکمیل شده است." };
  }
  let discount =
    row.kind === "PERCENT" ? Math.floor((opts.amount * row.value) / 100) : row.value;
  if (row.kind === "PERCENT" && row.maxDiscount !== null) {
    discount = Math.min(discount, row.maxDiscount);
  }
  discount = Math.max(0, Math.min(discount, opts.amount));

  if (discount === 0) return { ok: false, message: "این کد روی این مبلغ تخفیفی ندارد." };

  return {
    ok: true,
    codeId: row.id,
    code: row.code,
    discount,
    finalAmount: opts.amount - discount,
    label: describeDiscount(row),
  };
}

export function describeDiscount(row: {
  kind: string;
  value: number;
  maxDiscount: number | null;
}): string {
  if (row.kind === "PERCENT") {
    const cap = row.maxDiscount ? ` (حداکثر ${formatToman(row.maxDiscount)})` : "";
    return `${toFa(row.value)}٪ تخفیف${cap}`;
  }
  return `${formatToman(row.value)} تخفیف`;
}

/**
 * ثبت مصرف کد. شمارنده با شرط اتمی بالا می‌رود تا دو نفر هم‌زمان نتوانند
 * از آخرین ظرفیت استفاده کنند.
 */
export async function redeemDiscount(opts: {
  codeId: string;
  customerId: string;
  amount: number;
  appointmentId?: string | null;
}): Promise<boolean> {
  const claimed = await prisma.discountCode.updateMany({
    where: {
      id: opts.codeId,
      isActive: true,
      OR: [{ maxUses: null }, { usedCount: { lt: prisma.discountCode.fields.maxUses } }],
    },
    data: { usedCount: { increment: 1 } },
  });
  if (claimed.count === 0) return false;

  await prisma.discountUse.create({
    data: {
      codeId: opts.codeId,
      customerId: opts.customerId,
      appointmentId: opts.appointmentId ?? null,
      amount: opts.amount,
    },
  });
  return true;
}
