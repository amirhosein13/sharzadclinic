/**
 * ───────────────────────────────────────────────────────────────
 *  تست اتصال به سرویس پیامک
 * ───────────────────────────────────────────────────────────────
 *
 *  اجرا:
 *    npm run sms:test                       فقط تنظیمات را نشان می‌دهد
 *    npm run sms:test -- --to=09123456789   یک پیامک واقعی می‌فرستد
 *    npm run sms:test -- --to=... --otp     کد ورود را هم تست می‌کند
 *
 *  بدون --to هیچ پیامکی ارسال نمی‌شود؛ فقط می‌گوید چه چیزی تنظیم شده
 *  و چه چیزی جا افتاده. با --to واقعاً پیام می‌رود و هزینه دارد.
 *
 *  چرا لازم است: خطای سرویس پیامک در جریان عادی سایت جایی دیده نمی‌شود
 *  و فقط «کد نرسید» به گوش می‌رسد. این اسکریپت پاسخ خودِ سرویس را
 *  عیناً چاپ می‌کند، پس می‌فهمی مشکل رمز است یا خط فرستنده یا الگو.
 */
// باید اولین import باشد: متغیرهای .env را قبل از هر چیز دیگری بار می‌کند
import { envLoad } from "./load-env";
import "../src/lib/timezone";
import { getSmsDriver, meliAccountInfo, smsRecipient } from "../src/lib/notifications/sms";

const args = process.argv.slice(2);
const to = args.find((a) => a.startsWith("--to="))?.split("=")[1] ?? "";
const withOtp = args.includes("--otp");
/** متن دلخواه — برای جدا کردن «مشکل متن» از «مشکل گیرنده یا خط» */
const customText = args.find((a) => a.startsWith("--text="))?.slice("--text=".length) ?? "";

/** رمز و کلید هیچ‌وقت کامل چاپ نمی‌شوند — این خروجی ممکن است جایی کپی شود */
function mask(value: string | undefined) {
  if (!value) return "❌ خالی";
  if (value.length <= 8) return `✅ تنظیم شده (${value.length} کاراکتر)`;
  return `✅ ${value.slice(0, 4)}…${value.slice(-4)}`;
}

function show(label: string, value: string | undefined, secret = false) {
  const shown = secret ? mask(value) : value ? `✅ ${value}` : "❌ خالی";
  console.log(`  ${label.padEnd(28)} ${shown}`);
}

async function main() {
  const provider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();

  console.log("\n📋 تنظیمات پیامک\n");
  show("SMS_PROVIDER", provider);

  // تله‌ی رایج: تنظیمات تازه ته .env اضافه می‌شود در حالی که همان کلید
  // بالاتر هم هست. مقدارِ اولی برنده است و هیچ خطایی داده نمی‌شود.
  const clashing = envLoad.duplicates.filter(
    (k) => k.startsWith("SMS_") || k.startsWith("MELIPAYAMAK_") || k.startsWith("KAVENEGAR_"),
  );
  if (clashing.length) {
    console.log(
      `\n⚠️  این کلیدها بیش از یک بار در .env آمده‌اند: ${clashing.join("، ")}\n` +
        "   مقدارِ *اولین* بار برنده است، نه آخرین. اگر تنظیمات تازه را ته\n" +
        "   فایل اضافه کرده‌ای، خط قدیمی بالاتر را پاک کن.",
    );
  }

  if (provider === "melipayamak" || provider === "meli") {
    show("MELIPAYAMAK_USERNAME", process.env.MELIPAYAMAK_USERNAME);
    show("MELIPAYAMAK_PASSWORD", process.env.MELIPAYAMAK_PASSWORD, true);
    show("MELIPAYAMAK_SENDER", process.env.MELIPAYAMAK_SENDER);
    show("MELIPAYAMAK_OTP_BODY_ID", process.env.MELIPAYAMAK_OTP_BODY_ID);
  } else if (provider === "kavenegar") {
    show("KAVENEGAR_API_KEY", process.env.KAVENEGAR_API_KEY, true);
    show("KAVENEGAR_SENDER", process.env.KAVENEGAR_SENDER);
    show("KAVENEGAR_OTP_TEMPLATE", process.env.KAVENEGAR_OTP_TEMPLATE);
  }

  const driver = getSmsDriver();
  console.log(`\n  درایور فعال:               ${driver.name}`);
  console.log(
    `  مسیر کد ورود:              ${
      driver.otpReady
        ? "سرویس اختصاصی الگو"
        : "پیامک معمولی از خط اختصاصی (سرویس الگو در دسترس نیست)"
    }`,
  );

  // اگر تنظیمات ناقص باشد، getSmsDriver بی‌صدا به حالت کنسول برمی‌گردد.
  // این سکوت خطرناک است: سایت بالا می‌آید، هیچ خطایی نمی‌دهد، و هیچ
  // پیامکی هم نمی‌رود. پس بلند می‌گوییمش.
  if (driver.name === "console" && provider !== "console") {
    console.log(
      `\n⚠️  SMS_PROVIDER روی «${provider}» است، ولی درایور به حالت کنسول برگشته.\n` +
        "   یعنی تنظیمات ناقص است و هیچ پیامکی ارسال نمی‌شود — سایت هم\n" +
        "   هیچ خطایی نشان نمی‌دهد. خط‌های ❌ بالا را پر کن.",
    );
  }

  // وضعیت حساب: اعتبار و خطوطی که واقعاً مال این حساب‌اند. وقتی ارسال
  // با کد ۱۱ رد می‌شود، جواب معمولاً همین‌جاست.
  if (driver.name === "melipayamak") {
    console.log("\n💳 وضعیت حساب ملی پیامک");
    const info = await meliAccountInfo();
    if (info.error) {
      console.log(`  ❌ خوانده نشد: ${info.error}`);
    } else {
      console.log(`  موجودی (تعداد پیامک):     ${info.credit ?? "نامشخص"}`);
      console.log(`  موجودی ریالی:              ${info.rials ?? "نامشخص"}`);
      if (info.numbers?.length) {
        console.log(`  خطوط این حساب:             ${info.numbers.join("، ")}`);
        const sender = process.env.MELIPAYAMAK_SENDER ?? "";
        if (sender && !info.numbers.includes(sender)) {
          console.log(
            `\n  ⚠️  «${sender}» که در MELIPAYAMAK_SENDER گذاشته‌ای جزو خطوط\n` +
              "     این حساب نیست. یکی از شماره‌های بالا را بگذار.",
          );
        }
      } else {
        console.log("  خطوط این حساب:             هیچ خطی برگردانده نشد");
      }
    }
  }

  if (!to) {
    console.log(
      "\n   برای ارسال واقعی:  npm run sms:test -- --to=09123456789" +
        "\n   تست کد ورود:       --otp" +
        "\n   متن دلخواه:        --text=\"سلام\"\n",
    );
    return;
  }

  const recipient = smsRecipient(to);
  if (!/^09\d{9}$/.test(recipient)) {
    console.error(`\n❌ شماره‌ی «${to}» معتبر نیست. قالب درست: 09123456789\n`);
    process.exit(1);
  }

  // متن پیش‌فرض عمداً ساده است: بدون لینک، بدون عدد چسبیده، بدون
  // کلمه‌ای که فیلتر شود. اگر همین هم رد شود، مشکل از متن نیست.
  const stamp = new Date().toLocaleTimeString("fa-IR");
  const body =
    customText || `تست اتصال سامانه‌ی کلینیک شهرزاد — ${stamp}. اگر این پیام رسید، پیامک درست کار می‌کند.`;

  console.log(`\n📤 ارسال پیامک آزمایشی به ${recipient} ...`);
  console.log(`   متن (${body.length} کاراکتر): ${body}`);
  const plain = await driver.send(recipient, body);

  if (plain.ok) {
    console.log(`✅ پذیرفته شد${plain.providerId ? ` — شناسه: ${plain.providerId}` : ""}`);
    if (plain.simulated) console.log("   (فقط شبیه‌سازی شد؛ واقعاً ارسال نشده)");
  } else {
    console.log(`❌ ارسال نشد: ${plain.error}`);
  }

  let otpOk = true;
  if (withOtp) {
    console.log(`\n🔑 ارسال کد ورود آزمایشی به ${recipient} ...`);

    // همان تصمیمی که sendSms در جریان واقعی می‌گیرد: اگر سرویس الگو
    // در دسترس نباشد، کد به‌شکل پیامک معمولی می‌رود. اگر اینجا مستقیم
    // sendOtp صدا زده می‌شد، تست چیزی را می‌سنجید که در عمل اتفاق
    // نمی‌افتد.
    const otp = driver.otpReady
      ? await driver.sendOtp(recipient, "12345")
      : await driver.send(recipient, "کد ورود شما به کلینیک شهرزاد: 12345");

    otpOk = otp.ok;
    if (otp.ok) {
      console.log(`✅ پذیرفته شد${otp.providerId ? ` — شناسه: ${otp.providerId}` : ""}`);
      if (otp.simulated) console.log("   (فقط شبیه‌سازی شد)");
      if (!driver.otpReady) console.log("   (به‌شکل پیامک معمولی رفت، نه از مسیر الگو)");
    } else {
      console.log(`❌ ارسال نشد: ${otp.error}`);
    }
  }

  console.log(
    plain.ok && otpOk
      ? "\n   اگر پیام روی گوشی رسید، کار تمام است. اگر «پذیرفته شد» دیدی\n" +
          "   ولی پیام نرسید، مشکل سمت اپراتور یا خط فرستنده است — با\n" +
          "   پشتیبانی ملی پیامک و همان شناسه‌ی بالا تماس بگیر.\n"
      : "\n   متن خطا را با تنظیمات بالا مقایسه کن.\n",
  );
}

main().catch((error) => {
  console.error("❌ متوقف شد:", error);
  process.exit(1);
});
