import "../src/lib/timezone";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  CATEGORIES, SERVICES, STAFF, POSTS, TESTIMONIALS, GALLERY, CONSENT_TEMPLATES,
} from "./seed-data";

const prisma = new PrismaClient();

function code(i: number) {
  return `SH-SEED${String(i).padStart(2, "0")}`;
}

async function main() {
  console.log("🌱 در حال پرکردن دیتابیس...");

  // ─── کاربر ادمین ─────────────────────────────────────────
  const email = (process.env.ADMIN_EMAIL || "admin@sharzadclinic.ir").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: process.env.ADMIN_NAME || "مدیر کلینیک",
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
    },
  });
  console.log(`   👤 ادمین: ${email} / ${password}`);

  // ─── ساعات کاری کلینیک (۰ = شنبه) ────────────────────────
  for (let weekday = 0; weekday <= 6; weekday++) {
    const isFriday = weekday === 6;
    const isThursday = weekday === 5;
    await prisma.workingHour.upsert({
      where: { weekday },
      update: {},
      create: {
        weekday,
        isOpen: !isFriday,
        startTime: "09:00",
        endTime: isThursday ? "17:00" : "21:00",
      },
    });
  }

  // ─── دسته‌بندی خدمات ─────────────────────────────────────
  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      update: { title: c.title, description: c.description, icon: c.icon, order: c.order },
      create: { slug: c.slug, title: c.title, description: c.description, icon: c.icon, order: c.order },
    });
    categoryIds.set(c.slug, row.id);
  }

  // ─── خدمات ───────────────────────────────────────────────
  const serviceIds = new Map<string, string>();
  for (const [i, s] of SERVICES.entries()) {
    const data = {
      title: s.title,
      shortDescription: s.short,
      description: s.body,
      image: `/images/services/${s.slug}.svg`,
      priceFrom: s.priceFrom ?? null,
      priceTo: s.priceTo ?? null,
      durationMinutes: s.duration,
      sessionsNeeded: s.sessions ?? null,
      preparation: s.prep ?? null,
      aftercare: s.after ?? null,
      isFeatured: s.featured ?? false,
      order: i,
      categoryId: categoryIds.get(s.categorySlug)!,
      metaTitle: `${s.title} در کلینیک زیبایی شهرزاد`,
      metaDescription: s.short,
    } satisfies Omit<Prisma.ServiceUncheckedCreateInput, "slug">;

    const row = await prisma.service.upsert({
      where: { slug: s.slug },
      update: data,
      create: { slug: s.slug, ...data },
    });
    serviceIds.set(s.slug, row.id);

    await prisma.serviceFaq.deleteMany({ where: { serviceId: row.id } });
    if (s.faqs?.length) {
      await prisma.serviceFaq.createMany({
        data: s.faqs.map((f, idx) => ({ serviceId: row.id, question: f.q, answer: f.a, order: idx })),
      });
    }
  }

  // ─── پرسنل + برنامه‌ی هفتگی + خدمات ──────────────────────
  const staffIds = new Map<string, string>();
  for (const st of STAFF) {
    const row = await prisma.staff.upsert({
      where: { slug: st.slug },
      update: { name: st.name, title: st.title, bio: st.bio, order: st.order },
      create: {
        slug: st.slug,
        name: st.name,
        title: st.title,
        bio: st.bio,
        licenseNo: "licenseNo" in st ? st.licenseNo : null,
        avatar: `/images/staff/${st.slug}.svg`,
        order: st.order,
      },
    });
    staffIds.set(st.slug, row.id);

    await prisma.staffOnService.deleteMany({ where: { staffId: row.id } });
    await prisma.staffOnService.createMany({
      data: st.serviceSlugs
        .filter((sl) => serviceIds.has(sl))
        .map((sl) => ({ staffId: row.id, serviceId: serviceIds.get(sl)! })),
      skipDuplicates: true,
    });

    // شنبه تا چهارشنبه ۹–۱۸، پنجشنبه ۹–۱۴
    await prisma.staffSchedule.deleteMany({ where: { staffId: row.id } });
    await prisma.staffSchedule.createMany({
      data: [0, 1, 2, 3, 4, 5].map((weekday) => ({
        staffId: row.id,
        weekday,
        startTime: "09:00",
        endTime: weekday === 5 ? "14:00" : "18:00",
      })),
    });
  }

  // ─── مجله ────────────────────────────────────────────────
  const postCategories = [...new Set(POSTS.map((p) => p.category))];
  const postCategoryIds = new Map<string, string>();
  for (const title of postCategories) {
    const slug = { "مراقبت پوست": "skincare", "لیزر": "laser", "تزریقات": "injections", "مو": "hair" }[title] ?? "general";
    const row = await prisma.postCategory.upsert({ where: { slug }, update: { title }, create: { slug, title } });
    postCategoryIds.set(title, row.id);
  }

  for (const [i, p] of POSTS.entries()) {
    const publishedAt = new Date(Date.now() - (i + 1) * 6 * 24 * 3600 * 1000);
    const data = {
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      coverImage: `/images/blog/${p.slug}.svg`,
      readingMinutes: Math.max(2, Math.round(p.content.split(/\s+/).length / 200)),
      isPublished: true,
      publishedAt,
      views: 120 + i * 37,
      categoryId: postCategoryIds.get(p.category) ?? null,
      metaTitle: p.title,
      metaDescription: p.excerpt,
    };
    await prisma.post.upsert({ where: { slug: p.slug }, update: data, create: { slug: p.slug, ...data } });
  }

  // ─── نظرات ───────────────────────────────────────────────
  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({
      data: TESTIMONIALS.map((t, i) => ({ ...t, isApproved: true, order: i })),
    });
  }

  // ─── گالری قبل/بعد ───────────────────────────────────────
  if ((await prisma.galleryItem.count()) === 0) {
    await prisma.galleryItem.createMany({
      data: GALLERY.map((g, i) => ({
        title: g.title,
        description: g.description,
        serviceSlug: g.serviceSlug,
        beforeImage: `/images/gallery/before-${i + 1}.svg`,
        afterImage: `/images/gallery/after-${i + 1}.svg`,
        order: i,
        isPublished: true,
      })),
    });
  }

  // ─── چند مشتری و نوبت نمونه (فقط برای دیدن پنل) ──────────
  if ((await prisma.customer.count()) === 0) {
    const sample = [
      { firstName: "مریم", lastName: "رضایی", phone: "09121110001" },
      { firstName: "الهام", lastName: "کریمی", phone: "09121110002" },
      { firstName: "نگین", lastName: "محمدی", phone: "09121110003" },
      { firstName: "سحر", lastName: "بهرامی", phone: "09121110004" },
      { firstName: "زهرا", lastName: "حسینی", phone: "09121110005" },
    ];
    const customers = [];
    for (const c of sample) {
      customers.push(await prisma.customer.create({ data: c }));
    }

    const bookableSlugs = ["laser", "botox", "hydrafacial", "filler", "consultation"];
    const staffForService = await prisma.staffOnService.findMany();

    for (const [i, customer] of customers.entries()) {
      const serviceId = serviceIds.get(bookableSlugs[i % bookableSlugs.length])!;
      const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
      const staffId = staffForService.find((s) => s.serviceId === serviceId)?.staffId ?? null;

      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + (i % 3) + 1);
      startsAt.setHours(10 + i, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

      await prisma.appointment.create({
        data: {
          code: code(i),
          customerId: customer.id,
          serviceId,
          staffId,
          startsAt,
          endsAt,
          status: i % 3 === 0 ? "CONFIRMED" : "PENDING",
          source: "seed",
        },
      });
    }
  }

  // ─── رضایت‌نامه‌ها ────────────────────────────────────────
  for (const t of CONSENT_TEMPLATES) {
    await prisma.consentTemplate.upsert({
      where: { slug: t.slug },
      // متن موجود بازنویسی نمی‌شود تا ویرایش‌های کلینیک از بین نرود
      update: {},
      create: { slug: t.slug, title: t.title, body: t.body, order: t.order },
    });
  }

  console.log("✅ دیتابیس آماده شد.");
}

main()
  .catch((e) => {
    console.error("❌ خطا در seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
