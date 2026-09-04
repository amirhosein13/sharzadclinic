/**
 * تغییر رمز عبور یک حساب پنل از روی سرور — راه برگشتِ نهایی وقتی پیامک
 * قطع است یا برای حساب موبایلی ثبت نشده.
 *
 *   npm run reset-password                       فهرست حساب‌ها را نشان می‌دهد
 *   npm run reset-password -- --email a@b.c      رمز تصادفی می‌سازد و چاپ می‌کند
 *   npm run reset-password -- --email a@b.c --password "رمز دلخواه"
 *
 * قفلِ «چند تلاش ناموفق» هم برداشته می‌شود تا بلافاصله بتوان وارد شد.
 */
import "../src/lib/timezone";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { clearLoginAttempts } from "../src/lib/login-guard";
import { ROLE_LABELS } from "../src/lib/permissions";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** رمز خوانا ولی تصادفی — تا مدیر بتواند تلفنی بخواندش */
function suggestPassword(): string {
  return `Sharzad-${randomBytes(4).toString("hex")}`;
}

async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { email: true, name: true, role: true, isActive: true, phone: true },
  });

  if (users.length === 0) {
    console.log("هیچ حساب پنلی وجود ندارد. اول `npm run db:seed` را اجرا کنید.");
    return;
  }

  console.log("حساب‌های پنل:\n");
  for (const u of users) {
    const flags = [
      ROLE_LABELS[u.role],
      u.isActive ? null : "غیرفعال",
      u.phone ? null : "بدون موبایل (بازیابی از سایت ندارد)",
    ].filter(Boolean);
    console.log(`  ${u.email}\n    ${u.name} — ${flags.join(" • ")}`);
  }
  console.log(`\nبرای عوض‌کردن رمز:\n  npm run reset-password -- --email ${users[0].email}`);
}

async function main() {
  const email = arg("email")?.toLowerCase().trim();
  if (!email) {
    await listUsers();
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ حسابی با ایمیل ${email} پیدا نشد.\n`);
    await listUsers();
    process.exitCode = 1;
    return;
  }

  const password = arg("password") ?? suggestPassword();
  if (password.length < 8) {
    console.error("❌ رمز عبور باید حداقل ۸ کاراکتر باشد.");
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12), isActive: true },
  });
  // اگر حساب به‌خاطر تلاش‌های ناموفق قفل شده، همین‌جا باز می‌شود
  await clearLoginAttempts(email);

  await prisma.auditLog
    .create({
      data: { action: "password.reset.cli", entity: "User", entityId: user.id, detail: email },
    })
    .catch(() => undefined);

  console.log(`✅ رمز عبور «${user.name}» عوض شد.`);
  console.log(`   ایمیل: ${email}`);
  console.log(`   رمز:   ${password}`);
  console.log("\n⚠️  این رمز را بعد از ورود از پنل عوض کنید.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
