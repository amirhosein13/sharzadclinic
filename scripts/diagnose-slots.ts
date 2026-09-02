/**
 * چرا وقت خالی نشان داده نمی‌شود؟
 * اجرا:  npm run doctor
 *
 * همان شرط‌هایی را که موتور نوبت‌دهی بررسی می‌کند یکی‌یکی چک و گزارش
 * می‌کند، تا به‌جای حدس‌زدن بدانی کدام تنظیم غلط است.
 */
import "../src/lib/timezone";
import { PrismaClient } from "@prisma/client";
import { getAvailableSlots } from "../src/lib/availability";
import { getSettings } from "../src/lib/settings";
import { listBackups } from "../src/lib/backup";
import { formatJalali, jalaliWeekday, WEEKDAYS_FA, ymdKey } from "../src/lib/date";
import { toFa } from "../src/lib/utils";

const prisma = new PrismaClient();
const problems: string[] = [];

const OK = "✅";
const WARN = "⚠️ ";
const BAD = "❌";

async function main() {
  const settings = await getSettings();
  const now = new Date();

  console.log("\n────────────────────────────────────────────────");
  console.log(`  تشخیص نوبت‌دهی — ${formatJalali(now)} ساعت ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`);
  console.log("────────────────────────────────────────────────\n");

  console.log("⚙️  تنظیمات رزرو");
  console.log(`   کمترین فاصله تا نوبت: ${toFa(settings.bookingLeadHours)} ساعت`);
  console.log(`   تا چند روز آینده باز است: ${toFa(settings.bookingHorizonDays)} روز`);
  console.log(`   گام پیش‌فرض بین نوبت‌ها: ${toFa(settings.slotStepMinutes)} دقیقه`);

  /* ── سرویس‌های بیرونی ────────────────────────────────── */
  console.log("\n🔌 سرویس‌های بیرونی (از فایل .env خوانده می‌شود)");

  const smsProvider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const isMeli = smsProvider === "melipayamak" || smsProvider === "meli";
  const smsReady = isMeli
    ? !!process.env.MELIPAYAMAK_USERNAME && !!process.env.MELIPAYAMAK_PASSWORD
    : smsProvider === "kavenegar" && !!process.env.KAVENEGAR_API_KEY;
  console.log(
    smsReady
      ? `   ${OK} پیامک — ${isMeli ? "ملی پیامک" : "کاوه‌نگار"} فعال است`
      : `   ${WARN}پیامک — حالت «${smsProvider}»: پیامک واقعی ارسال نمی‌شود، فقط در ترمینال چاپ می‌شود`,
  );
  if (smsReady && isMeli && !process.env.MELIPAYAMAK_SENDER) {
    problems.push("MELIPAYAMAK_SENDER (شماره‌ی فرستنده) تنظیم نشده — پیامک‌های عادی ارسال نمی‌شوند.");
  }
  if (smsReady && isMeli && !process.env.MELIPAYAMAK_OTP_BODY_ID) {
    problems.push(
      "MELIPAYAMAK_OTP_BODY_ID تنظیم نشده — کد ورود مشتری ارسال نمی‌شود و کسی نمی‌تواند وارد حسابش شود.",
    );
  }
  if (!smsReady) {
    problems.push(
      "پیامک واقعی ارسال نمی‌شود (SMS_PROVIDER/KAVENEGAR_API_KEY در .env تنظیم نشده) — مشتری نمی‌تواند وارد حسابش شود.",
    );
  }
  if (smsProvider === "kavenegar" && !process.env.KAVENEGAR_OTP_TEMPLATE) {
    problems.push("KAVENEGAR_OTP_TEMPLATE تنظیم نشده — کد ورود مشتری با الگوی تأییدشده ارسال نمی‌شود.");
  }

  const merchantId = process.env.ZARINPAL_MERCHANT_ID ?? "";
  const gatewayReady = /^[0-9a-fA-F-]{36}$/.test(merchantId);
  console.log(
    gatewayReady
      ? `   ${OK} درگاه پرداخت — زرین‌پال ${process.env.ZARINPAL_SANDBOX === "true" ? "(سندباکس)" : "(واقعی)"}`
      : `   ${WARN}درگاه پرداخت — خاموش: ${merchantId ? "ZARINPAL_MERCHANT_ID معتبر نیست" : "ZARINPAL_MERCHANT_ID در .env نیست"}`,
  );
  if (!gatewayReady) {
    problems.push(
      "درگاه پرداخت خاموش است، پس در فرم رزرو مرحله‌ی پرداخت بیعانه اصلاً نشان داده نمی‌شود و نوبت مستقیم ثبت می‌شود. برای روشن‌کردنش ZARINPAL_MERCHANT_ID را در .env بگذار.",
    );
  }

  const emailReady = !!process.env.SMTP_HOST && !!process.env.SMTP_USER;
  console.log(
    emailReady
      ? `   ${OK} ایمیل — SMTP تنظیم شده`
      : `   ${WARN}ایمیل — SMTP تنظیم نشده: ایمیل‌ها فقط در ترمینال چاپ می‌شوند (اختیاری)`,
  );

  const secret = process.env.AUTH_SECRET ?? "";
  const weakSecret = secret.length < 32 || secret.includes("CHANGE_ME");
  console.log(
    weakSecret
      ? `   ${BAD} AUTH_SECRET — ${secret ? "هنوز مقدار نمونه است" : "تنظیم نشده"}`
      : `   ${OK} AUTH_SECRET — تنظیم شده`,
  );
  if (weakSecret) {
    problems.push("AUTH_SECRET هنوز مقدار نمونه است — قبل از انتشار با `openssl rand -base64 32` عوضش کن.");
  }

  /* ── پشتیبان‌گیری ────────────────────────────────────── */
  console.log("\n🗄️  پشتیبان‌گیری");
  const backups = await listBackups();
  if (backups.length === 0) {
    console.log(`   ${BAD} هیچ پشتیبانی وجود ندارد`);
    problems.push(
      "هیچ پشتیبانی از دیتابیس گرفته نشده. یک بار `npm run backup` بزن و کرون شبانه را روی سرور تنظیم کن.",
    );
  } else {
    const days = Math.floor((Date.now() - backups[0].createdAt.getTime()) / 86_400_000);
    console.log(
      `   ${days <= 1 ? OK : WARN}آخرین پشتیبان: ${formatJalali(backups[0].createdAt)} (${toFa(days)} روز پیش) • ${toFa(backups.length)} نسخه`,
    );
    if (days > 1) {
      problems.push(`${toFa(days)} روز است پشتیبان گرفته نشده — کرون شبانه را بررسی کن.`);
    }
  }

  /* ── ساعات کاری کلینیک ───────────────────────────────── */
  console.log("\n🏥 ساعات کاری کلینیک");
  const hours = await prisma.workingHour.findMany({ orderBy: { weekday: "asc" } });
  if (hours.length === 0) {
    console.log(`   ${WARN}هیچ ساعت کاری ثبت نشده — پیش‌فرض ۰۹:۰۰ تا ۲۱:۰۰ در نظر گرفته می‌شود.`);
  }
  const openDays: number[] = [];
  for (let w = 0; w < 7; w++) {
    const row = hours.find((h) => h.weekday === w);
    const open = row ? row.isOpen : true;
    if (open) openDays.push(w);
    console.log(
      `   ${WEEKDAYS_FA[w].padEnd(8, " ")} ${open ? `${row?.startTime ?? "09:00"} تا ${row?.endTime ?? "21:00"}` : "تعطیل"}`,
    );
  }
  if (openDays.length === 0) {
    problems.push("همه‌ی روزهای هفته در «تنظیمات ← ساعات کاری» تعطیل‌اند؛ هیچ نوبتی نشان داده نمی‌شود.");
  }

  /* ── پرسنل ───────────────────────────────────────────── */
  console.log("\n👩‍⚕️ پرسنل");
  const staff = await prisma.staff.findMany({
    include: {
      schedules: { where: { isActive: true } },
      services: { select: { serviceId: true } },
    },
    orderBy: { order: "asc" },
  });

  if (staff.length === 0) {
    problems.push("هیچ پرسنلی ثبت نشده است.");
  }

  let bookableStaff = 0;
  for (const s of staff) {
    const flags: string[] = [];
    if (!s.isActive) flags.push("غیرفعال");
    if (!s.acceptsBookings) flags.push("رزرو آنلاین خاموش");
    if (s.schedules.length === 0) flags.push("بدون برنامه‌ی هفتگی");
    if (s.services.length === 0) flags.push("به هیچ خدمتی وصل نیست");

    const usable = flags.length === 0;
    if (usable) bookableStaff++;

    const days = s.schedules.map((x) => WEEKDAYS_FA[x.weekday]).join("، ");
    console.log(
      `   ${usable ? OK : BAD} ${s.name} — ${toFa(s.services.length)} خدمت` +
        (s.schedules.length ? ` • ${days}` : "") +
        (flags.length ? `  ⟵ ${flags.join(" + ")}` : ""),
    );

    if (!usable && s.isActive) {
      problems.push(`«${s.name}» در رزرو آنلاین دیده نمی‌شود چون: ${flags.join(" و ")}.`);
    }
  }
  if (bookableStaff === 0 && staff.length > 0) {
    problems.push("هیچ پرسنلِ قابل رزروی وجود ندارد؛ به همین دلیل هیچ خدمتی وقت خالی نشان نمی‌دهد.");
  }

  /* ── خدمات ───────────────────────────────────────────── */
  console.log("\n💆 خدمات");
  const services = await prisma.service.findMany({
    include: { staff: { select: { staffId: true } } },
    orderBy: { order: "asc" },
  });

  const bookableServices: typeof services = [];
  for (const svc of services) {
    const reasons: string[] = [];
    if (!svc.isActive) reasons.push("غیرفعال");
    if (!svc.isBookable) reasons.push("رزرو آنلاین ندارد");

    const usableStaff = svc.staff.filter((link) => {
      const member = staff.find((s) => s.id === link.staffId);
      return member && member.isActive && member.acceptsBookings && member.schedules.length > 0;
    });
    if (svc.isActive && svc.isBookable && usableStaff.length === 0) {
      reasons.push("پرسنلِ آماده ندارد");
    }

    if (reasons.length === 0) bookableServices.push(svc);
    if (svc.isActive && svc.isBookable) {
      console.log(
        `   ${reasons.length ? BAD : OK} ${svc.title} — ${toFa(usableStaff.length)} پرسنلِ آماده` +
          (reasons.length ? `  ⟵ ${reasons.join(" + ")}` : ""),
      );
      if (reasons.length) {
        problems.push(`خدمت «${svc.title}» وقت خالی نشان نمی‌دهد چون ${reasons.join(" و ")}.`);
      }
    }
  }

  /* ── مرخصی‌های پیش‌رو ─────────────────────────────────── */
  const soon = new Date(now.getTime() + 14 * 86_400_000);
  const offs = await prisma.timeOff.findMany({
    where: { to: { gte: now }, from: { lte: soon } },
    include: { staff: { select: { name: true } } },
    orderBy: { from: "asc" },
  });
  if (offs.length > 0) {
    console.log("\n🌴 مرخصی‌های دو هفته‌ی آینده");
    for (const off of offs) {
      console.log(
        `   ${off.staff?.name ?? "کل کلینیک"} — ${formatJalali(off.from)} تا ${formatJalali(off.to)}` +
          (off.reason ? ` (${off.reason})` : ""),
      );
    }
  }

  /* ── شمارش واقعی وقت‌های خالی ─────────────────────────── */
  console.log("\n📅 وقت‌های خالی ۷ روز آینده (بر اساس همان موتور سایت)");
  const sample = bookableServices.slice(0, 5);
  if (sample.length === 0) {
    console.log(`   ${BAD} هیچ خدمتِ قابل رزروی نمانده که بشود شمرد.`);
  }

  let anySlot = false;
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const key = ymdKey(day);
    const parts: string[] = [];
    for (const svc of sample) {
      const slots = await getAvailableSlots({ serviceId: svc.id, dateKey: key });
      if (slots.length > 0) anySlot = true;
      parts.push(`${svc.title}: ${toFa(slots.length)}`);
    }
    const weekday = WEEKDAYS_FA[jalaliWeekday(day)];
    console.log(`   ${formatJalali(day)} ${weekday.padEnd(8, " ")} ${parts.join("   ")}`);
  }

  if (!anySlot && sample.length > 0) {
    problems.push("در هیچ‌کدام از ۷ روز آینده هیچ وقت خالی‌ای پیدا نشد.");
  }

  /* ── جمع‌بندی ─────────────────────────────────────────── */
  console.log("\n────────────────────────────────────────────────");
  if (problems.length === 0) {
    console.log(`${OK} نوبت‌دهی سالم است.`);
    console.log("   اگر باز هم «وقت خالی نیست» می‌بینی، احتمالاً روزی را زده‌ای که");
    console.log("   کلینیک تعطیل است، یا امروز است و از ساعتِ مجاز گذشته.");
  } else {
    console.log(`${BAD} ${toFa(problems.length)} مشکل پیدا شد:\n`);
    for (const [i, p] of problems.entries()) console.log(`   ${toFa(i + 1)}. ${p}`);
    console.log("\n   بیشترشان از پنل درست می‌شوند:");
    console.log("   • برنامه‌ی هفتگی: پنل ← پرسنل ← روی هر نفر ← برنامه‌ی هفتگی");
    console.log("   • اتصال خدمت به پرسنل: پنل ← پرسنل ← خدمات همان نفر");
    console.log("   • ساعات کاری کلینیک: پنل ← تنظیمات ← ساعات کاری");
  }
  console.log("────────────────────────────────────────────────\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
