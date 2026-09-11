/**
 * ───────────────────────────────────────────────────────────────
 *  پاک‌کردن داده‌های نمایشی که هنگام ساخت پروژه برای دیدن پنل
 *  ساخته شده بودند.
 * ───────────────────────────────────────────────────────────────
 *
 *  اجرا:
 *    npm run clear-demo                 فقط گزارش می‌دهد، چیزی پاک نمی‌کند
 *    npm run clear-demo -- --yes        واقعاً پاک می‌کند
 *    npm run clear-demo -- --yes --keep=posts,staff
 *
 *  گروه‌ها: testimonials، gallery، posts، staff، customers
 *
 *  چیزهایی که عمداً دست‌نخورده می‌مانند، چون ساختارند نه محتوای
 *  ساختگی: دسته‌بندی و فهرست خدمات، ساعات کاری، قالب رضایت‌نامه،
 *  دسته‌های هزینه. این‌ها را مدیر از داخل پنل ویرایش می‌کند.
 *
 *  هیچ‌وقت به پرونده‌های منتقل‌شده از برنامه‌ی قدیمی دست نمی‌زند —
 *  شرط legacyId در همه‌ی کوئری‌ها هست.
 */
import "../src/lib/timezone";
import { prisma } from "../src/lib/prisma";
import { POSTS, STAFF, TESTIMONIALS } from "../prisma/seed-data";

const args = process.argv.slice(2);
const APPLY = args.includes("--yes");
const KEEP = (args.find((a) => a.startsWith("--keep="))?.split("=")[1] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const wanted = (group: string) => !KEEP.includes(group);

/** شماره‌هایی که در seed.ts برای مشتری‌های نمونه استفاده شده بود */
const DEMO_PHONES = [
  "09121110001",
  "09121110002",
  "09121110003",
  "09121110004",
  "09121110005",
];

const plan: { group: string; what: string; count: number; note?: string }[] = [];
let removed = 0;

function fa(n: number) {
  return n.toLocaleString("fa-IR");
}

async function doDelete(group: string, what: string, run: () => Promise<number>, note?: string) {
  const count = await run();
  plan.push({ group, what, count, note });
  if (APPLY) removed += count;
}

async function main() {
  console.log(
    APPLY
      ? "🧹 در حال پاک‌کردن داده‌های نمایشی...\n"
      : "🔍 حالت گزارش — چیزی پاک نمی‌شود. برای اجرای واقعی: --yes\n",
  );

  // ─── نظرات ساختگی ───────────────────────────────────────────
  // این‌ها مهم‌ترین‌اند: نظر جعلی بیمار روی سایت یک کلینیک پزشکی
  // نباید بماند.
  if (wanted("testimonials")) {
    const where = {
      OR: TESTIMONIALS.map((t) => ({ authorName: t.authorName, body: t.body })),
    };
    await doDelete("testimonials", "نظر ساختگی مراجعین", async () => {
      const n = await prisma.testimonial.count({ where });
      if (APPLY && n) await prisma.testimonial.deleteMany({ where });
      return n;
    });
  }

  // ─── گالری قبل/بعد ──────────────────────────────────────────
  // تصویرهای placeholder با نتیجه‌ی درمانی ساختگی.
  if (wanted("gallery")) {
    const where = { beforeImage: { startsWith: "/images/gallery/before-" } };
    await doDelete("gallery", "نمونه‌ی قبل/بعد ساختگی", async () => {
      const n = await prisma.galleryItem.count({ where });
      if (APPLY && n) await prisma.galleryItem.deleteMany({ where });
      return n;
    });
  }

  // ─── مقاله‌های مجله ─────────────────────────────────────────
  if (wanted("posts")) {
    const where = { slug: { in: POSTS.map((p) => p.slug) } };
    await doDelete("posts", "مقاله‌ی نمونه‌ی مجله", async () => {
      const n = await prisma.post.count({ where });
      if (APPLY && n) await prisma.post.deleteMany({ where });
      return n;
    });
  }

  // ─── مشتری‌های نمونه ────────────────────────────────────────
  // شرط legacyId حیاتی است: هیچ پرونده‌ی منتقل‌شده‌ای نباید قربانی
  // هم‌شماره‌بودن تصادفی شود.
  if (wanted("customers")) {
    const where = { phone: { in: DEMO_PHONES }, legacyId: null };
    const rows = await prisma.customer.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, _count: { select: { appointments: true } } },
    });
    const appts = rows.reduce((sum, r) => sum + r._count.appointments, 0);

    await doDelete(
      "customers",
      "پرونده‌ی نمونه",
      async () => {
        if (APPLY && rows.length) {
          await prisma.customer.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
        }
        return rows.length;
      },
      appts ? `به همراه ${fa(appts)} نوبت نمونه‌شان` : undefined,
    );

    // نوبت‌های seed که مشتری‌شان قبلاً دستی پاک شده باشد
    const orphan = { code: { startsWith: "SH-SEED" } };
    await doDelete("customers", "نوبت نمونه‌ی باقی‌مانده", async () => {
      const n = await prisma.appointment.count({ where: orphan });
      if (APPLY && n) await prisma.appointment.deleteMany({ where: orphan });
      return n;
    });
  }

  // ترتیب مهم است: بلوک مشتری‌های نمونه باید قبل از این اجرا شود.
  // نوبت‌های نمونه به اسم همین پرسنل خورده‌اند؛ اگر اول آن‌ها پاک
  // نشوند، این پرسنل «دارای سابقه» شمرده می‌شوند و به‌جای حذف فقط
  // غیرفعال می‌مانند.
  // ─── پرسنل ساختگی ───────────────────────────────────────────
  // اسم و شماره‌ی نظام پزشکیِ درآوردی. اگر نوبت یا سابقه‌ای به
  // اسمشان خورده باشد حذف نمی‌کنیم — فقط غیرفعال، تا هیچ رکورد
  // واقعی‌ای بی‌صاحب نشود.
  if (wanted("staff")) {
    const slugs = STAFF.map((s) => s.slug);
    const rows = await prisma.staff.findMany({
      where: { slug: { in: slugs } },
      select: {
        id: true,
        name: true,
        _count: { select: { appointments: true, treatments: true } },
      },
    });

    const free = rows.filter((r) => r._count.appointments === 0 && r._count.treatments === 0);
    const busy = rows.filter((r) => r._count.appointments > 0 || r._count.treatments > 0);

    await doDelete("staff", "پرسنل نمونه", async () => {
      if (APPLY && free.length) {
        await prisma.staff.deleteMany({ where: { id: { in: free.map((r) => r.id) } } });
      }
      return free.length;
    });

    if (busy.length) {
      await doDelete(
        "staff",
        "پرسنل نمونه‌ی دارای سابقه",
        async () => {
          if (APPLY) {
            await prisma.staff.updateMany({
              where: { id: { in: busy.map((r) => r.id) } },
              data: { isActive: false },
            });
          }
          return busy.length;
        },
        `حذف نشد چون رکورد واقعی به اسمشان خورده — فقط غیرفعال شد: ${busy
          .map((r) => r.name)
          .join("، ")}`,
      );
    }
  }

  // ─── گزارش ──────────────────────────────────────────────────
  const rows = plan.filter((p) => p.count > 0);
  if (rows.length === 0) {
    console.log("✅ هیچ داده‌ی نمایشی‌ای باقی نمانده بود.");
  } else {
    for (const r of rows) {
      console.log(`  ${APPLY ? "✅" : "•"} ${r.what.padEnd(28)} ${fa(r.count)}`);
      if (r.note) console.log(`     ↳ ${r.note}`);
    }
  }

  if (KEEP.length) console.log(`\n  دست‌نخورده ماند (--keep): ${KEEP.join("، ")}`);

  // آنچه عمداً می‌ماند
  const [services, categories] = await Promise.all([
    prisma.service.count(),
    prisma.serviceCategory.count(),
  ]);
  console.log(
    `\n  فهرست خدمات دست‌نخورده ماند: ${fa(services)} خدمت در ${fa(categories)} دسته.` +
      "\n  این‌ها ساختارند نه محتوای ساختگی — عنوان و قیمتشان را از پنل ویرایش کن.",
  );

  const real = await prisma.customer.count({ where: { legacyId: { not: null } } });
  console.log(`  پرونده‌های منتقل‌شده از برنامه‌ی قدیمی: ${fa(real)} — دست نخوردند.`);

  // بدون پرسنلِ فعال، «وقت خالی» وجود ندارد و رزرو آنلاین ساکت از کار
  // می‌افتد. این را باید بلند گفت، نه اینکه مدیر خودش کشف کند.
  const activeStaff = await prisma.staff.count({ where: { isActive: true } });
  if (activeStaff === 0) {
    console.log(
      "\n⚠️  هیچ پرسنل فعالی باقی نماند.\n" +
        "   تا وقتی در پنل → پرسنل، آدم واقعی با برنامه‌ی هفتگی و خدماتش\n" +
        "   ثبت نکنی، رزرو آنلاین به هیچ مراجعه‌کننده‌ای وقت خالی نشان نمی‌دهد.\n" +
        "   (ثبت نوبت توسط منشی از داخل پنل همچنان کار می‌کند.)",
    );
  }

  console.log(
    APPLY
      ? `\n🎉 ${fa(removed)} رکورد نمایشی پاک شد.`
      : "\n   برای اجرای واقعی: npm run clear-demo -- --yes",
  );
}

main()
  .catch((error) => {
    console.error("❌ متوقف شد:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
