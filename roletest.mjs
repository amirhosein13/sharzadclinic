import { chromium } from "playwright";
const B = "http://localhost:3123";
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function asUser(email, pass = "Test@12345") {
  const ctx = await br.newContext({ viewport: { width: 1440, height: 950 }, locale: "fa-IR" });
  const page = await ctx.newPage();
  await page.goto(B + "/admin/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  return page;
}

for (const [email, pass, label] of [
  ["admin@sharzadclinic.ir", "Admin@12345", "مدیر کل"],
  ["reception@test.ir", "Test@12345", "منشی"],
  ["operator@test.ir", "Test@12345", "اپراتور"],
]) {
  const page = await asUser(email, pass);
  const landing = page.url().replace(B, "");
  const menu = await page.locator('nav[aria-label="منوی مدیریت"] a').allTextContents();
  console.log(`\n── ${label} ──`);
  console.log("  صفحه‌ی ورود →", landing);
  console.log("  منو:", menu.map(m => m.replace(/\d+$/, "").trim()).join(" | "));

  // تلاش برای دسترسی به بخش‌های ممنوعه
  for (const path of ["/admin/settings", "/admin/users", "/admin/payroll", "/admin/services"]) {
    await page.goto(B + path, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const final = page.url().replace(B, "");
    console.log(`  ${path} → ${final === path ? "✅ مجاز" : "🔒 هدایت به " + final}`);
  }
  await page.context().close();
}
await br.close();
