/**
 * ───────────────────────────────────────────────────────────────
 *  مهاجرت داده‌ها از اپلیکیشن قدیمی (SQL Server) به سایت جدید
 * ───────────────────────────────────────────────────────────────
 *
 *  اجرا:
 *    npm run import:legacy -- --inspect     نمایش جدول‌ها و ستون‌های دیتابیس قدیمی
 *    npm run import:legacy -- --dry-run     شبیه‌سازی بدون نوشتن در دیتابیس
 *    npm run import:legacy                  اجرای واقعی
 *    npm run import:legacy -- --only=customers,payments   فقط بخش‌های مشخص
 *
 *  اتصال از متغیرهای LEGACY_MSSQL_* در فایل .env خوانده می‌شود.
 *  تنظیمات نگاشت ستون‌ها در scripts/legacy-mapping.ts است.
 */

import "../src/lib/timezone";
import sql from "mssql";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  APPOINTMENTS, AMOUNT_DIVISOR, CUSTOMERS, PAYMENTS, SERVICES, TREATMENTS,
  normalizeGender, normalizePaymentMethod, normalizeStatus, type LegacyMapping,
} from "./legacy-mapping";
import { normalizePhone, slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const INSPECT = args.includes("--inspect");
const DRY_RUN = args.includes("--dry-run");
const ONLY = (args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? "")
  .split(",")
  .filter(Boolean);

const shouldRun = (name: string) => ONLY.length === 0 || ONLY.includes(name);

const stats = { created: 0, updated: 0, skipped: 0, failed: 0 };

function log(icon: string, message: string) {
  console.log(`${icon} ${message}`);
}

// ─── اتصال ───────────────────────────────────────────────────────

async function connect(): Promise<sql.ConnectionPool> {
  const { LEGACY_MSSQL_SERVER, LEGACY_MSSQL_DATABASE, LEGACY_MSSQL_USER } = process.env;

  if (!LEGACY_MSSQL_SERVER || !LEGACY_MSSQL_DATABASE || !LEGACY_MSSQL_USER) {
    console.error(
      "❌ اطلاعات اتصال به SQL Server کامل نیست.\n" +
        "   متغیرهای LEGACY_MSSQL_SERVER، LEGACY_MSSQL_DATABASE و LEGACY_MSSQL_USER را در .env پر کن."
    );
    process.exit(1);
  }

  const config: sql.config = {
    server: LEGACY_MSSQL_SERVER,
    port: Number(process.env.LEGACY_MSSQL_PORT || 1433),
    database: LEGACY_MSSQL_DATABASE,
    user: LEGACY_MSSQL_USER,
    password: process.env.LEGACY_MSSQL_PASSWORD || "",
    options: {
      encrypt: process.env.LEGACY_MSSQL_ENCRYPT === "true",
      trustServerCertificate: process.env.LEGACY_MSSQL_TRUST_CERT !== "false",
    },
    requestTimeout: 120_000,
  };

  log("🔌", `اتصال به ${LEGACY_MSSQL_SERVER}/${LEGACY_MSSQL_DATABASE}...`);
  return sql.connect(config);
}

// ─── حالت بررسی ساختار ───────────────────────────────────────────

async function inspect(pool: sql.ConnectionPool) {
  const tables = await pool.request().query<{ TABLE_NAME: string }>(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
  );

  console.log(`\n📋 ${tables.recordset.length} جدول در دیتابیس قدیمی پیدا شد:\n`);

  for (const { TABLE_NAME } of tables.recordset) {
    const [columns, count] = await Promise.all([
      pool
        .request()
        .input("t", sql.NVarChar, TABLE_NAME)
        .query<{ COLUMN_NAME: string; DATA_TYPE: string }>(
          "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@t ORDER BY ORDINAL_POSITION"
        ),
      pool
        .request()
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM [${TABLE_NAME}]`)
        .catch(() => ({ recordset: [{ n: -1 }] })),
    ]);

    const rows = count.recordset[0]?.n ?? 0;
    console.log(`  ▸ ${TABLE_NAME}  (${rows >= 0 ? `${rows} رکورد` : "?"})`);
    console.log(
      `      ${columns.recordset.map((c) => `${c.COLUMN_NAME}:${c.DATA_TYPE}`).join(", ")}`
    );
  }

  console.log(
    "\n💡 حالا نام جدول‌ها و ستون‌ها را در scripts/legacy-mapping.ts مطابق خروجی بالا اصلاح کن.\n"
  );
}

// ─── کمکی‌ها ─────────────────────────────────────────────────────

async function fetchRows(
  pool: sql.ConnectionPool,
  mapping: LegacyMapping
): Promise<Record<string, unknown>[]> {
  const cols = new Set([mapping.idColumn, ...Object.values(mapping.columns)]);
  const select = [...cols].map((c) => `[${c}]`).join(", ");
  const result = await pool.request().query(`SELECT ${select} FROM [${mapping.table}]`);
  return result.recordset as Record<string, unknown>[];
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const date = (v: unknown): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

// ─── مهاجرت مشتریان ──────────────────────────────────────────────

async function importCustomers(pool: sql.ConnectionPool) {
  log("👥", `مهاجرت مشتریان از جدول [${CUSTOMERS.table}]...`);
  const rows = await fetchRows(pool, CUSTOMERS);
  const c = CUSTOMERS.columns;

  let created = 0;
  let updated = 0;
  const seenPhones = new Set<string>();

  for (const row of rows) {
    const legacyId = str(row[CUSTOMERS.idColumn]);
    if (!legacyId) {
      stats.skipped++;
      continue;
    }

    const rawPhone = str(row[c.phone]);
    const firstName = str(row[c.firstName]) ?? "بدون";
    const lastName = str(row[c.lastName]) ?? "نام";

    // شماره‌ی نامعتبر یا تکراری → شماره‌ی جایگزین یکتا تا رکورد از دست نرود
    let phone = rawPhone ? normalizePhone(rawPhone) : "";
    if (!/^09\d{9}$/.test(phone) || seenPhones.has(phone)) {
      phone = `LEGACY-${legacyId}`;
    }
    seenPhones.add(phone);

    const data = {
      firstName,
      lastName,
      phone,
      email: str(row[c.email]),
      nationalCode: str(row[c.nationalCode]),
      gender: normalizeGender(row[c.gender]),
      birthDate: date(row[c.birthDate]),
      address: str(row[c.address]),
      notes: str(row[c.notes]),
      ...(date(row[c.createdAt]) ? { createdAt: date(row[c.createdAt])! } : {}),
    } satisfies Omit<Prisma.CustomerUncheckedCreateInput, "legacyId">;

    if (DRY_RUN) {
      created++;
      continue;
    }

    try {
      const existing = await prisma.customer.findUnique({ where: { legacyId } });
      if (existing) {
        await prisma.customer.update({ where: { legacyId }, data });
        updated++;
      } else {
        await prisma.customer.create({ data: { legacyId, ...data } });
        created++;
      }
    } catch (error) {
      stats.failed++;
      console.warn(`   ⚠️  مشتری ${legacyId} منتقل نشد:`, (error as Error).message.split("\n")[0]);
    }
  }

  stats.created += created;
  stats.updated += updated;
  log("   ✓", `${rows.length} رکورد خوانده شد → ${created} جدید، ${updated} به‌روزرسانی`);
}

// ─── مهاجرت خدمات ────────────────────────────────────────────────

async function importServices(pool: sql.ConnectionPool) {
  if (!SERVICES) return;
  log("✨", `مهاجرت خدمات از جدول [${SERVICES.table}]...`);

  const rows = await fetchRows(pool, SERVICES);
  const c = SERVICES.columns;

  // خدمات منتقل‌شده در یک دسته‌ی جداگانه می‌نشینند تا با محتوای سایت قاطی نشوند
  const category = DRY_RUN
    ? null
    : await prisma.serviceCategory.upsert({
        where: { slug: "legacy" },
        update: {},
        create: {
          slug: "legacy",
          title: "منتقل‌شده از اپ قبلی",
          description: "خدماتی که از دیتابیس اپلیکیشن قدیمی وارد شده‌اند.",
          order: 99,
          isActive: false,
        },
      });

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const legacyId = str(row[SERVICES.idColumn]);
    const title = str(row[c.title]);
    if (!legacyId || !title) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      created++;
      continue;
    }

    const price = num(row[c.price]);
    const data = {
      title,
      priceFrom: price !== null ? Math.round(price / AMOUNT_DIVISOR) : null,
      durationMinutes: num(row[c.durationMinutes]) ?? 60,
      categoryId: category!.id,
      isActive: false, // تا خودت بررسی و فعالشان کنی
      isBookable: false,
    };

    try {
      const existing = await prisma.service.findUnique({ where: { legacyId } });
      if (existing) {
        await prisma.service.update({ where: { legacyId }, data });
        updated++;
      } else {
        await prisma.service.create({
          data: { legacyId, slug: `legacy-${slugify(title)}-${legacyId}`, ...data },
        });
        created++;
      }
    } catch (error) {
      stats.failed++;
      console.warn(`   ⚠️  خدمت ${legacyId} منتقل نشد:`, (error as Error).message.split("\n")[0]);
    }
  }

  stats.created += created;
  stats.updated += updated;
  log("   ✓", `${rows.length} رکورد خوانده شد → ${created} جدید، ${updated} به‌روزرسانی`);
}

// ─── مهاجرت نوبت‌ها ──────────────────────────────────────────────

async function importAppointments(pool: sql.ConnectionPool) {
  if (!APPOINTMENTS) return;
  log("📅", `مهاجرت نوبت‌ها از جدول [${APPOINTMENTS.table}]...`);

  const rows = await fetchRows(pool, APPOINTMENTS);
  const c = APPOINTMENTS.columns;

  const [customers, services] = await Promise.all([
    prisma.customer.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } }),
    prisma.service.findMany({ select: { id: true, legacyId: true, title: true, durationMinutes: true } }),
  ]);

  const customerByLegacy = new Map(customers.map((x) => [x.legacyId!, x.id]));
  const serviceByLegacy = new Map(services.filter((s) => s.legacyId).map((s) => [s.legacyId!, s]));
  const serviceByTitle = new Map(services.map((s) => [s.title.trim(), s]));
  const fallbackService = services[0];

  let created = 0;

  for (const row of rows) {
    const legacyId = str(row[APPOINTMENTS.idColumn]);
    const customerId = customerByLegacy.get(str(row[c.customerLegacyId]) ?? "");
    const startsAt = date(row[c.startsAt]);

    if (!legacyId || !customerId || !startsAt) {
      stats.skipped++;
      continue;
    }

    const service =
      serviceByLegacy.get(str(row[c.serviceLegacyId]) ?? "") ??
      serviceByTitle.get(str(row[c.serviceTitle]) ?? "") ??
      fallbackService;

    if (!service) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      created++;
      continue;
    }

    const duration = num(row[c.durationMinutes]) ?? service.durationMinutes;

    try {
      await prisma.appointment.upsert({
        where: { legacyId },
        update: {},
        create: {
          legacyId,
          code: `LG-${legacyId}`.slice(0, 20),
          customerId,
          serviceId: service.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + duration * 60_000),
          status: normalizeStatus(row[c.status]),
          note: str(row[c.note]),
          source: "legacy",
        },
      });
      created++;
    } catch (error) {
      stats.failed++;
      console.warn(`   ⚠️  نوبت ${legacyId} منتقل نشد:`, (error as Error).message.split("\n")[0]);
    }
  }

  stats.created += created;
  log("   ✓", `${rows.length} رکورد خوانده شد → ${created} منتقل شد`);
}

// ─── مهاجرت سوابق درمان ──────────────────────────────────────────

async function importTreatments(pool: sql.ConnectionPool) {
  if (!TREATMENTS) return;
  log("📁", `مهاجرت سوابق درمان از جدول [${TREATMENTS.table}]...`);

  const rows = await fetchRows(pool, TREATMENTS);
  const c = TREATMENTS.columns;

  const [customers, services] = await Promise.all([
    prisma.customer.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } }),
    prisma.service.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } }),
  ]);
  const customerByLegacy = new Map(customers.map((x) => [x.legacyId!, x.id]));
  const serviceByLegacy = new Map(services.map((x) => [x.legacyId!, x.id]));

  let created = 0;

  for (const row of rows) {
    const legacyId = str(row[TREATMENTS.idColumn]);
    const customerId = customerByLegacy.get(str(row[c.customerLegacyId]) ?? "");
    const performedAt = date(row[c.performedAt]);

    if (!legacyId || !customerId || !performedAt) {
      stats.skipped++;
      continue;
    }
    if (DRY_RUN) {
      created++;
      continue;
    }

    try {
      await prisma.treatmentRecord.upsert({
        where: { legacyId },
        update: {},
        create: {
          legacyId,
          customerId,
          serviceId: serviceByLegacy.get(str(row[c.serviceLegacyId]) ?? "") ?? null,
          performedAt,
          sessionNo: num(row[c.sessionNo]),
          description: str(row[c.description]),
        },
      });
      created++;
    } catch (error) {
      stats.failed++;
      console.warn(`   ⚠️  سابقه ${legacyId} منتقل نشد:`, (error as Error).message.split("\n")[0]);
    }
  }

  stats.created += created;
  log("   ✓", `${rows.length} رکورد خوانده شد → ${created} منتقل شد`);
}

// ─── مهاجرت پرداخت‌ها ────────────────────────────────────────────

async function importPayments(pool: sql.ConnectionPool) {
  if (!PAYMENTS) return;
  log("💳", `مهاجرت پرداخت‌ها از جدول [${PAYMENTS.table}]...`);

  const rows = await fetchRows(pool, PAYMENTS);
  const c = PAYMENTS.columns;

  const customers = await prisma.customer.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true },
  });
  const customerByLegacy = new Map(customers.map((x) => [x.legacyId!, x.id]));

  let created = 0;

  for (const row of rows) {
    const legacyId = str(row[PAYMENTS.idColumn]);
    const customerId = customerByLegacy.get(str(row[c.customerLegacyId]) ?? "");
    const amount = num(row[c.amount]);
    const paidAt = date(row[c.paidAt]);

    if (!legacyId || !customerId || amount === null || !paidAt) {
      stats.skipped++;
      continue;
    }
    if (DRY_RUN) {
      created++;
      continue;
    }

    try {
      await prisma.payment.upsert({
        where: { legacyId },
        update: {},
        create: {
          legacyId,
          customerId,
          amount: Math.round(amount / AMOUNT_DIVISOR),
          method: normalizePaymentMethod(row[c.method]),
          paidAt,
          reference: str(row[c.reference]),
          note: str(row[c.note]),
        },
      });
      created++;
    } catch (error) {
      stats.failed++;
      console.warn(`   ⚠️  پرداخت ${legacyId} منتقل نشد:`, (error as Error).message.split("\n")[0]);
    }
  }

  stats.created += created;
  log("   ✓", `${rows.length} رکورد خوانده شد → ${created} منتقل شد`);
}

// ─── اجرا ────────────────────────────────────────────────────────

async function main() {
  const pool = await connect();
  log("✅", "اتصال برقرار شد.\n");

  if (INSPECT) {
    await inspect(pool);
    await pool.close();
    return;
  }

  if (DRY_RUN) {
    console.log("🧪 حالت آزمایشی — هیچ چیزی در دیتابیس نوشته نمی‌شود.\n");
  }

  // ترتیب مهم است: مشتری و خدمت باید قبل از نوبت و پرداخت منتقل شوند
  if (shouldRun("services")) await importServices(pool);
  if (shouldRun("customers")) await importCustomers(pool);
  if (shouldRun("appointments")) await importAppointments(pool);
  if (shouldRun("treatments")) await importTreatments(pool);
  if (shouldRun("payments")) await importPayments(pool);

  await pool.close();

  console.log("\n─────────────────────────────────────");
  console.log(`  ✅ ایجادشده:     ${stats.created}`);
  console.log(`  🔄 به‌روزرسانی:   ${stats.updated}`);
  console.log(`  ⏭️  ردشده:        ${stats.skipped}`);
  console.log(`  ❌ ناموفق:       ${stats.failed}`);
  console.log("─────────────────────────────────────\n");

  if (!DRY_RUN && stats.created > 0) {
    console.log("💡 حالا در پنل مدیریت → مشتریان، رکوردهای منتقل‌شده را ببین.");
    console.log("   خدمات منتقل‌شده غیرفعال هستند تا خودت بررسی و فعالشان کنی.\n");
  }
}

main()
  .catch((error) => {
    console.error("\n❌ مهاجرت با خطا متوقف شد:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
