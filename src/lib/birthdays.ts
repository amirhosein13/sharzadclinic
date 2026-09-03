import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { normalizePhone } from "./utils";

export type BirthdayCustomer = {
  id: string;
  name: string;
  phone: string;
};

/**
 * مشتریانی که امروز تولدشان است.
 *
 * تولد را با ماه و روزِ میلادیِ ذخیره‌شده مقایسه می‌کنیم؛ چون هر دو طرف
 * از یک تقویم می‌آیند، معادل مقایسه‌ی شمسی است و نیازی به تبدیل نیست.
 */
export async function todaysBirthdays(day = new Date()): Promise<BirthdayCustomer[]> {
  const rows = await prisma.customer.findMany({
    where: { birthDate: { not: null }, isBlocked: false },
    select: { id: true, firstName: true, lastName: true, phone: true, birthDate: true },
  });

  return rows
    .filter(
      (c) =>
        c.birthDate!.getMonth() === day.getMonth() && c.birthDate!.getDate() === day.getDate(),
    )
    .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, phone: c.phone }));
}

/** آیا امسال برای این شماره پیامک تولد رفته؟ جلوی ارسال تکراری را می‌گیرد */
export async function alreadyGreetedThisYear(phone: string, day = new Date()): Promise<boolean> {
  const yearStart = new Date(day.getFullYear(), 0, 1);
  const sent = await prisma.notificationLog.findFirst({
    where: {
      template: "birthday",
      recipient: normalizePhone(phone),
      status: { in: ["sent", "skipped"] },
      createdAt: { gte: yearStart },
    },
    select: { id: true },
  });
  return !!sent;
}

/** متن پیامک تولد — اگر کد تخفیفی تنظیم شده باشد، به آن اشاره می‌کند */
export async function birthdayMessage(name: string): Promise<string> {
  const settings = await getSettings();
  const code = (settings.birthdayDiscountCode || "").trim();

  const lines = [`${name} عزیز، تولدتان مبارک! 🌸`];
  if (code) {
    lines.push(`به همین مناسبت کد تخفیف «${code}» برای شما فعال است.`);
  }
  lines.push(settings.clinicName);
  return lines.join("\n");
}
