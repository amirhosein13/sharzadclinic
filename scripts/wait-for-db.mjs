// منتظر می‌ماند تا کانتینر PostgreSQL آماده‌ی اتصال شود
import { execSync } from "node:child_process";

const MAX = 40;
for (let i = 1; i <= MAX; i++) {
  try {
    execSync("docker compose exec -T db pg_isready -U sharzad -d sharzad", { stdio: "ignore" });
    console.log("✅ دیتابیس آماده است.");
    process.exit(0);
  } catch {
    process.stdout.write(`⏳ در انتظار دیتابیس... (${i}/${MAX})\r`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
console.error("\n❌ دیتابیس بالا نیامد. `docker compose logs db` را بررسی کن.");
process.exit(1);
