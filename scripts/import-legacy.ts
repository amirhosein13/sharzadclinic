/**
 * ───────────────────────────────────────────────────────────────
 *  مهاجرت داده‌ها از برنامه‌ی قدیمی (SQL Server) به سایت جدید
 * ───────────────────────────────────────────────────────────────
 *
 *  اجرا:
 *    npm run import:legacy -- --inspect   ساختار و آمار دیتابیس قدیمی
 *    npm run import:legacy -- --report    گزارش کامل بدون نوشتن در دیتابیس
 *    npm run import:legacy -- --dry-run   شبیه‌سازی کامل بدون نوشتن
 *    npm run import:legacy                اجرای واقعی
 *
 *    --only=customers,visits,appointments,expenses   فقط بخش‌های مشخص
 *    --out=migration-report                          پوشه‌ی فایل‌های CSV
 *    --raw-amounts                                   مبالغ را اصلاح نکن
 *
 *  اتصال از متغیرهای LEGACY_MSSQL_* در فایل .env خوانده می‌شود.
 *  نگاشت جدول‌ها در scripts/legacy-mapping.ts و قانون‌های پاک‌سازی در
 *  scripts/legacy-clean.ts است.
 *
 *  مهاجرت idempotent است: هر رکورد با legacyId یکتا ثبت می‌شود، پس اجرای
 *  چندباره رکورد تکراری نمی‌سازد.
 */

import "../src/lib/timezone";
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_DURATION_MINUTES, IMPORTED_APPOINTMENT_STATUS, SERVICE_SLUG_BY_NAME, TABLES,
} from "./legacy-mapping";
import {
  cleanAmount, cleanDate, cleanPhone, identityKey, normalizeName, tidyName,
} from "./legacy-clean";
import { formatToman, slugify, toFa } from "../src/lib/utils";
import { formatJalaliLong } from "../src/lib/date";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const INSPECT = args.includes("--inspect");
const REPORT_ONLY = args.includes("--report");
const DRY_RUN = args.includes("--dry-run") || REPORT_ONLY;
const RAW_AMOUNTS = args.includes("--raw-amounts");
const OUT_DIR = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? "migration-report";
const ONLY = (args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? "")
  .split(",")
  .filter(Boolean);

const shouldRun = (name: string) => ONLY.length === 0 || ONLY.includes(name);
const log = (icon: string, message: string) => console.log(`${icon} ${message}`);

// ─── گزارش ───────────────────────────────────────────────────────

/** هر چیزی که آدم باید بداند: چه عوض شد، چه رد شد، و چرا */
type Issue = {
  kind: string;
  legacyId: string;
  who: string;
  detail: string;
};

const issues: Issue[] = [];
const note = (kind: string, legacyId: string, who: string, detail: string) =>
  issues.push({ kind, legacyId, who, detail });

const stats = {
  customers: { created: 0, updated: 0, merged: 0, skipped: 0 },
  services: { created: 0, matched: 0 },
  visits: { created: 0, skipped: 0 },
  payments: { created: 0, amountFixed: 0 },
  appointments: { created: 0, relinked: 0, skipped: 0 },
  expenses: { created: 0 },
  staff: { created: 0 },
};

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
    requestTimeout: 300_000,
  };

  log("🔌", `اتصال به ${LEGACY_MSSQL_SERVER}/${LEGACY_MSSQL_DATABASE}...`);
  return sql.connect(config);
}

async function rows<T>(pool: sql.ConnectionPool, query: string): Promise<T[]> {
  const result = await pool.request().query<T>(query);
  return result.recordset ?? [];
}

// ─── بررسی ساختار ────────────────────────────────────────────────

async function inspect(pool: sql.ConnectionPool) {
  const tables = await rows<{ name: string; rows: number }>(
    pool,
    `SELECT t.name AS name, SUM(p.rows) AS rows
     FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
     GROUP BY t.name ORDER BY t.name`
  );

  console.log(`\n📋 ${toFa(tables.length)} جدول در دیتابیس قدیمی:\n`);
  for (const t of tables) console.log(`   ${t.name.padEnd(24)} ${toFa(t.rows)} ردیف`);

  const services = await rows<{ hozeid: number; hozename: string }>(
    pool,
    `SELECT hozeid, hozename FROM ${TABLES.services} ORDER BY hozeid`
  );
  console.log(`\n💅 خدمات برنامه‌ی قدیمی:\n`);
  for (const s of services) {
    const target = SERVICE_SLUG_BY_NAME[String(s.hozename ?? "").trim()];
    console.log(`   ${String(s.hozename).padEnd(20)} → ${target ?? "خدمت تازه ساخته می‌شود"}`);
  }
  console.log();
}

// ─── مشتری‌ها ────────────────────────────────────────────────────

type LegacyCustomer = {
  moshtaryid: number;
  moshtaryname: string | null;
  moshtaryfamily: string | null;
  phonenumber: string | null;
  nemiad: boolean;
};

/** legacyId مشتری قدیمی → شناسه‌ی مشتری در دیتابیس جدید */
const customerIdByLegacy = new Map<string, string>();
/** کلید هویت (شماره + نام) → شناسه‌ی جدید، برای وصل‌کردن رزروهای بی‌صاحب */
const customerIdByIdentity = new Map<string, string>();
/** نام نرمال‌شده → شناسه‌های جدید، برای وقتی شماره نداریم */
const customerIdsByName = new Map<string, string[]>();

async function importCustomers(pool: sql.ConnectionPool) {
  const list = await rows<LegacyCustomer>(
    pool,
    `SELECT moshtaryid, moshtaryname, moshtaryfamily, phonenumber, nemiad
     FROM ${TABLES.customers} ORDER BY moshtaryid`
  );

  // شماره‌ی پرونده: یک نفر ممکن است چند شماره داشته باشد؛ همه را نگه می‌داریم
  const fileNos = await rows<{ anotherid: number; beref: number }>(
    pool,
    `SELECT DISTINCT anotherid, beref FROM ${TABLES.fileNumbers} ORDER BY anotherid, beref`
  );
  const fileNoByCustomer = new Map<number, number[]>();
  for (const f of fileNos) {
    const arr = fileNoByCustomer.get(f.anotherid) ?? [];
    arr.push(f.beref);
    fileNoByCustomer.set(f.anotherid, arr);
  }

  // یک شماره‌ی پرونده که به چند نفر داده شده، یعنی پرونده‌ی کاغذیِ مبهم
  const ownersOfFileNo = new Map<number, number[]>();
  for (const f of fileNos) {
    const arr = ownersOfFileNo.get(f.beref) ?? [];
    arr.push(f.anotherid);
    ownersOfFileNo.set(f.beref, arr);
  }

  log("👥", `${toFa(list.length)} مشتری در برنامه‌ی قدیمی`);

  for (const row of list) {
    const legacyId = `moshtary-${row.moshtaryid}`;
    const firstName = tidyName(row.moshtaryname);
    const lastName = tidyName(row.moshtaryfamily);
    const who = `${firstName} ${lastName}`.trim() || `#${row.moshtaryid}`;

    if (!firstName && !lastName) {
      stats.customers.skipped++;
      note("مشتری بی‌نام", legacyId, who, "نه نام داشت نه نام خانوادگی؛ وارد نشد");
      continue;
    }

    const phone = cleanPhone(row.phonenumber);
    if (phone.note) note("شماره", legacyId, who, phone.note);

    // شماره‌ی نامعتبر پرونده را دور نمی‌ریزد؛ فقط این پرونده پیامک و ورود ندارد
    const storedPhone = phone.value || `نامشخص-${row.moshtaryid}`;

    const myFileNos = fileNoByCustomer.get(row.moshtaryid) ?? [];
    const legacyFileNo = myFileNos.length ? myFileNos.join("،") : null;

    if (myFileNos.length === 0) {
      note("شماره پرونده", legacyId, who, "در برنامه‌ی قدیمی شماره‌ی پرونده نداشت");
    } else if (myFileNos.length > 1) {
      note("شماره پرونده", legacyId, who, `چند شماره‌ی پرونده داشت: ${myFileNos.join("، ")}`);
    }
    for (const no of myFileNos) {
      const owners = ownersOfFileNo.get(no) ?? [];
      if (owners.length > 1) {
        note("شماره پرونده", legacyId, who, `شماره‌ی ${no} به ${owners.length} پرونده داده شده بود`);
      }
    }

    const notes: string[] = [];
    if (phone.kind === "landline") notes.push(`شماره‌ی ثابت: ${phone.value}`);
    if (phone.kind === "invalid" && phone.value) {
      notes.push(`شماره‌ی ثبت‌شده در برنامه‌ی قدیمی: ${phone.value} (ناقص)`);
    }
    if (row.nemiad) notes.push("در برنامه‌ی قدیمی «نمی‌آید» علامت خورده بود");

    // تکراری واقعی: همان شماره و همان نام. دو بار ثبت شده بوده.
    const identity = phone.value ? identityKey(phone.value, firstName, lastName) : "";
    const twin = identity ? customerIdByIdentity.get(identity) : undefined;
    if (twin) {
      stats.customers.merged++;
      customerIdByLegacy.set(legacyId, twin);
      note("پرونده‌ی تکراری", legacyId, who, "با پرونده‌ی هم‌نام و هم‌شماره یکی شد");
      if (!DRY_RUN && legacyFileNo) {
        // شماره‌ی پرونده‌ی نسخه‌ی تکراری هم باید قابل جستجو بماند
        const kept = await prisma.customer.findUnique({
          where: { id: twin },
          select: { legacyFileNo: true },
        });
        const merged = [
          ...new Set([...(kept?.legacyFileNo?.split("،") ?? []), ...myFileNos.map(String)]),
        ].join("،");
        await prisma.customer.update({ where: { id: twin }, data: { legacyFileNo: merged } });
      }
      continue;
    }

    if (DRY_RUN) {
      stats.customers.created++;
      const fake = `dry-${row.moshtaryid}`;
      customerIdByLegacy.set(legacyId, fake);
      if (identity) customerIdByIdentity.set(identity, fake);
      pushByName(firstName, lastName, fake);
      continue;
    }

    const data = {
      firstName,
      lastName,
      phone: storedPhone,
      legacyFileNo,
      notes: notes.length ? notes.join("\n") : null,
      isBlocked: false,
    };

    const saved = await prisma.customer.upsert({
      where: { legacyId },
      update: data,
      create: { ...data, legacyId },
    });

    stats.customers.created++;
    customerIdByLegacy.set(legacyId, saved.id);
    if (identity) customerIdByIdentity.set(identity, saved.id);
    pushByName(firstName, lastName, saved.id);
  }

  log("✅", `مشتری‌ها: ${toFa(stats.customers.created)} ثبت، ${toFa(stats.customers.merged)} یکی‌شده، ${toFa(stats.customers.skipped)} رد`);
}

function pushByName(firstName: string, lastName: string, id: string) {
  const key = normalizeName(`${firstName} ${lastName}`);
  const arr = customerIdsByName.get(key) ?? [];
  arr.push(id);
  customerIdsByName.set(key, arr);
}

// ─── خدمات ───────────────────────────────────────────────────────

const serviceIdByLegacy = new Map<number, string>();
const serviceDuration = new Map<string, number>();

async function importServices(pool: sql.ConnectionPool) {
  const list = await rows<{ hozeid: number; hozename: string | null; ghaymathoze: number; modatdore: number }>(
    pool,
    `SELECT hozeid, hozename, ghaymathoze, modatdore FROM ${TABLES.services} ORDER BY hozeid`
  );

  for (const row of list) {
    const title = tidyName(row.hozename) || `خدمت ${row.hozeid}`;
    const slug = SERVICE_SLUG_BY_NAME[title];

    let service = slug
      ? await prisma.service.findUnique({ where: { slug } })
      : await prisma.service.findFirst({ where: { title } });

    if (service) {
      stats.services.matched++;
    } else if (DRY_RUN) {
      stats.services.created++;
      serviceIdByLegacy.set(row.hozeid, `dry-service-${row.hozeid}`);
      serviceDuration.set(`dry-service-${row.hozeid}`, DEFAULT_DURATION_MINUTES);
      note("خدمت", `hoze-${row.hozeid}`, title, "خدمت تازه ساخته می‌شود");
      continue;
    } else {
      // هیچ خدمتی نباید باعث گم‌شدن سابقه شود؛ اگر نبود، می‌سازیمش
      const category =
        (await prisma.serviceCategory.findFirst({ where: { slug: "laser" } })) ??
        (await prisma.serviceCategory.findFirstOrThrow({}));
      service = await prisma.service.create({
        data: {
          slug: slugify(title) || `legacy-${row.hozeid}`,
          title,
          categoryId: category.id,
          isBookable: false,
          isActive: false,
          durationMinutes: DEFAULT_DURATION_MINUTES,
        },
      });
      stats.services.created++;
      note("خدمت", `hoze-${row.hozeid}`, title, "در سایت جدید نبود؛ غیرفعال ساخته شد");
    }

    serviceIdByLegacy.set(row.hozeid, service.id);
    serviceDuration.set(service.id, service.durationMinutes || DEFAULT_DURATION_MINUTES);
  }

  log("💅", `خدمات: ${toFa(stats.services.matched)} تطبیق داده شد، ${toFa(stats.services.created)} ساخته شد`);
}

// ─── مراجعه‌ها (سابقه + پول) ─────────────────────────────────────

async function importVisits(pool: sql.ConnectionPool) {
  const list = await rows<{
    harbarid: number; moshtaryid: number; hozeid: number; pardakhty: number; tarikh: Date;
  }>(
    pool,
    `SELECT h.harbarid, h.moshtaryid, h.hozeid, h.pardakhty, d.tarikh
     FROM ${TABLES.visits} h JOIN ${TABLES.days} d ON d.dayid = h.dayid
     ORDER BY h.harbarid`
  );

  log("📋", `${toFa(list.length)} مراجعه در برنامه‌ی قدیمی`);

  for (const row of list) {
    const legacyId = `harbar-${row.harbarid}`;
    const customerId = customerIdByLegacy.get(`moshtary-${row.moshtaryid}`);
    if (!customerId) {
      stats.visits.skipped++;
      note("مراجعه", legacyId, `#${row.moshtaryid}`, "مشتری‌اش وارد نشده بود");
      continue;
    }

    const when = cleanDate(row.tarikh);
    if (!when.value) {
      stats.visits.skipped++;
      note("مراجعه", legacyId, `#${row.moshtaryid}`, when.note ?? "تاریخ نامعتبر");
      continue;
    }
    if (when.note) note("تاریخ مراجعه", legacyId, `#${row.moshtaryid}`, when.note);

    const serviceId = serviceIdByLegacy.get(row.hozeid) ?? null;
    const amount = RAW_AMOUNTS
      ? { value: row.pardakhty, note: null }
      : cleanAmount(row.pardakhty);
    if (amount.note) {
      stats.payments.amountFixed++;
      note("مبلغ", legacyId, `#${row.moshtaryid}`, `${amount.note} → ${formatToman(amount.value)}`);
    }

    if (DRY_RUN) {
      stats.visits.created++;
      if (amount.value > 0) stats.payments.created++;
      continue;
    }

    await prisma.treatmentRecord.upsert({
      where: { legacyId },
      update: { performedAt: when.value, serviceId, description: amount.note },
      create: {
        legacyId,
        customerId,
        serviceId: serviceId && !serviceId.startsWith("dry-") ? serviceId : null,
        performedAt: when.value,
        description: amount.note,
      },
    });
    stats.visits.created++;

    // پول جدا از سابقه ثبت می‌شود تا در گزارش درآمد بیاید
    if (amount.value > 0) {
      await prisma.payment.upsert({
        where: { legacyId: `pardakht-${row.harbarid}` },
        update: { amount: amount.value, paidAt: when.value },
        create: {
          legacyId: `pardakht-${row.harbarid}`,
          customerId,
          amount: amount.value,
          method: "CASH",
          status: "PAID",
          paidAt: when.value,
          note: amount.note ?? "منتقل‌شده از برنامه‌ی قدیمی",
        },
      });
      stats.payments.created++;
    }
  }

  log("✅", `مراجعه‌ها: ${toFa(stats.visits.created)} ثبت، ${toFa(stats.visits.skipped)} رد — ${toFa(stats.payments.created)} پرداخت`);
}

// ─── نوبت‌ها ─────────────────────────────────────────────────────

async function importAppointments(pool: sql.ConnectionPool) {
  const list = await rows<{
    rezervvaghtid: number; hozeid: number; khodevaght: Date;
    idmoshtary: number; namemoshtary: string | null; family: string | null; phonenumber: string | null;
  }>(
    pool,
    `SELECT rezervvaghtid, hozeid, khodevaght, idmoshtary, namemoshtary, family, phonenumber
     FROM ${TABLES.reservations} ORDER BY rezervvaghtid`
  );

  log("📅", `${toFa(list.length)} رزرو در برنامه‌ی قدیمی`);

  for (const row of list) {
    const legacyId = `rezerv-${row.rezervvaghtid}`;
    const who = `${tidyName(row.namemoshtary)} ${tidyName(row.family)}`.trim() || `#${row.rezervvaghtid}`;

    const when = cleanDate(row.khodevaght);
    // تاریخ را زودتر حساب می‌کنیم تا در گزارشِ موارد ردشده هم بیاید؛ بدون
    // تاریخ، سطرِ «این نوبت وارد نشد» برای منشی بی‌فایده است
    const dated = when.value ? formatJalaliLong(when.value) : "بدون تاریخ";

    let customerId = row.idmoshtary
      ? customerIdByLegacy.get(`moshtary-${row.idmoshtary}`)
      : undefined;

    // یک‌سومِ رزروها به مشتری وصل نیستند چون برنامه‌ی قدیمی با نامِ تقریبی
    // جستجو می‌کرد. با نام نرمال‌شده دوباره وصلشان می‌کنیم.
    if (!customerId) {
      const candidates = customerIdsByName.get(
        normalizeName(`${tidyName(row.namemoshtary)} ${tidyName(row.family)}`)
      );
      if (candidates?.length === 1) {
        customerId = candidates[0];
        stats.appointments.relinked++;
      } else if (candidates && candidates.length > 1) {
        stats.appointments.skipped++;
        note("نوبت", legacyId, who, `${dated} — ${candidates.length} مشتری با این نام هست؛ معلوم نشد کدام`);
        continue;
      }
    }

    if (!customerId) {
      stats.appointments.skipped++;
      note("نوبت", legacyId, who, `${dated} — مشتری‌اش در برنامه‌ی قدیمی ثبت نشده بود`);
      continue;
    }

    if (!when.value) {
      stats.appointments.skipped++;
      note("نوبت", legacyId, who, when.note ?? "تاریخ نامعتبر");
      continue;
    }
    if (when.note) note("تاریخ نوبت", legacyId, who, when.note);

    const serviceId = serviceIdByLegacy.get(row.hozeid);
    if (!serviceId || serviceId.startsWith("dry-")) {
      if (DRY_RUN) {
        stats.appointments.created++;
        continue;
      }
      stats.appointments.skipped++;
      note("نوبت", legacyId, who, "خدمتش پیدا نشد");
      continue;
    }

    if (DRY_RUN) {
      stats.appointments.created++;
      continue;
    }

    const minutes = serviceDuration.get(serviceId) ?? DEFAULT_DURATION_MINUTES;
    await prisma.appointment.upsert({
      where: { legacyId },
      update: { startsAt: when.value, endsAt: new Date(when.value.getTime() + minutes * 60_000) },
      create: {
        legacyId,
        code: `OLD-${row.rezervvaghtid}`,
        customerId,
        serviceId,
        startsAt: when.value,
        endsAt: new Date(when.value.getTime() + minutes * 60_000),
        status: IMPORTED_APPOINTMENT_STATUS,
        source: "legacy",
        note: when.note,
      },
    });
    stats.appointments.created++;
  }

  log("✅", `نوبت‌ها: ${toFa(stats.appointments.created)} ثبت (${toFa(stats.appointments.relinked)} با نام دوباره وصل شد)، ${toFa(stats.appointments.skipped)} رد`);
}

// ─── هزینه‌ها و پرسنل ────────────────────────────────────────────

/** دسته‌ی هزینه‌ها؛ هزینه بدون دسته ثبت نمی‌شود */
let expenseCategoryId: string | null = null;
async function expenseCategory(): Promise<string> {
  if (expenseCategoryId) return expenseCategoryId;
  const found =
    (await prisma.expenseCategory.findFirst({ where: { isSystem: false } })) ??
    (await prisma.expenseCategory.create({
      data: { slug: "legacy", title: "منتقل‌شده از برنامه‌ی قدیمی" },
    }));
  expenseCategoryId = found.id;
  return found.id;
}

async function importExpenses(pool: sql.ConnectionPool) {
  const list = await rows<{ rizkhargid: number; tarikh: Date; mablag: number; tozihat: string | null }>(
    pool,
    `SELECT rizkhargid, tarikh, mablag, tozihat FROM ${TABLES.expenses} ORDER BY rizkhargid`
  );

  for (const row of list) {
    const when = cleanDate(row.tarikh);
    if (!when.value) {
      note("هزینه", `kharg-${row.rizkhargid}`, "—", when.note ?? "تاریخ نامعتبر");
      continue;
    }
    const amount = RAW_AMOUNTS ? { value: row.mablag, note: null } : cleanAmount(row.mablag);
    if (DRY_RUN) {
      stats.expenses.created++;
      continue;
    }
    const category = await expenseCategory();
    await prisma.expense.upsert({
      where: { legacyId: `kharg-${row.rizkhargid}` },
      update: { amount: amount.value, spentAt: when.value },
      create: {
        legacyId: `kharg-${row.rizkhargid}`,
        title: tidyName(row.tozihat) || "هزینه‌ی منتقل‌شده",
        amount: amount.value,
        categoryId: category,
        spentAt: when.value,
        note: amount.note,
      },
    });
    stats.expenses.created++;
  }

  if (list.length) log("✅", `هزینه‌ها: ${toFa(stats.expenses.created)} ثبت`);
}

async function importStaff(pool: sql.ConnectionPool) {
  const list = await rows<{ karmandid: number; karmandname: string | null; karmandfamily: string | null }>(
    pool,
    `SELECT karmandid, karmandname, karmandfamily FROM ${TABLES.staff} ORDER BY karmandid`
  );

  for (const row of list) {
    const name = `${tidyName(row.karmandname)} ${tidyName(row.karmandfamily)}`.trim();
    if (!name) continue;
    if (DRY_RUN) {
      stats.staff.created++;
      continue;
    }
    const slug = slugify(name) || `staff-${row.karmandid}`;
    await prisma.staff.upsert({
      where: { slug },
      update: {},
      create: { slug, name, title: "پرسنل", isActive: false },
    });
    stats.staff.created++;
  }

  if (list.length) log("✅", `پرسنل: ${toFa(stats.staff.created)} ثبت`);
}

// ─── تاریخ عضویت ─────────────────────────────────────────────────

/**
 * برنامه‌ی قدیمی تاریخ ثبت‌نام مشتری را نگه نمی‌داشت، پس همه‌ی پرونده‌های
 * منتقل‌شده تاریخِ روزِ مهاجرت را می‌گیرند. اگر همین‌طور بماند، گزارش
 * «مشتری جدید این ماه» می‌گوید ۲۶۷۰ نفر — که فاجعه است.
 *
 * پس تاریخ عضویت را از قدیمی‌ترین ردِ خودِ مشتری برمی‌داریم: اولین مراجعه
 * یا اولین نوبتش. کسی که هیچ ردی ندارد، تاریخِ قدیمی‌ترین رکورد کل سیستم را
 * می‌گیرد — چون هرچه بوده، قبل از مهاجرت بوده.
 */
async function backfillJoinDates() {
  if (DRY_RUN) return;

  const [firstVisit, firstAppt] = await Promise.all([
    prisma.treatmentRecord.aggregate({ _min: { performedAt: true }, where: { legacyId: { not: null } } }),
    prisma.appointment.aggregate({ _min: { startsAt: true }, where: { legacyId: { not: null } } }),
  ]);

  const candidates = [firstVisit._min.performedAt, firstAppt._min.startsAt].filter(
    (d): d is Date => !!d,
  );
  if (candidates.length === 0) return;
  const epoch = new Date(Math.min(...candidates.map((d) => d.getTime())));

  // یک دستور SQL برای همه؛ ۲۶۷۰ به‌روزرسانی جدا کند و بی‌دلیل است
  const updated = await prisma.$executeRaw`
    UPDATE customers c
    SET "createdAt" = COALESCE(
      -- LEAST در پستگرس NULL را نادیده می‌گیرد، پس هرکدام که باشد برنده است
      LEAST(
        (SELECT MIN(t."performedAt") FROM treatment_records t WHERE t."customerId" = c.id),
        (SELECT MIN(a."startsAt")    FROM appointments a     WHERE a."customerId" = c.id)
      ),
      -- هیچ ردی ندارد: فقط می‌دانیم قبل از مهاجرت بوده
      ${epoch}::timestamp
    )
    WHERE c."legacyId" IS NOT NULL`;

  log("📆", `تاریخ عضویت ${toFa(updated)} پرونده از قدیمی‌ترین سابقه‌شان تنظیم شد`);
}

// ─── نوشتن گزارش ─────────────────────────────────────────────────

function writeReport() {
  if (issues.length === 0) return;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, "بررسی-دستی.csv");

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [
    ["موضوع", "شناسه‌ی قدیمی", "مشتری", "توضیح"].map(esc).join(","),
    ...issues.map((i) => [i.kind, i.legacyId, i.who, i.detail].map(esc).join(",")),
  ].join("\n");

  // BOM تا اکسل فارسی را درست باز کند
  fs.writeFileSync(file, "﻿" + csv, "utf8");
  log("📄", `${toFa(issues.length)} مورد برای بررسی در ${file} نوشته شد`);

  const byKind = new Map<string, number>();
  for (const i of issues) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
  console.log("\n   دسته‌بندی موارد:");
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${kind.padEnd(20)} ${toFa(n)}`);
  }
}

// ─── اجرا ────────────────────────────────────────────────────────

async function main() {
  const pool = await connect();

  try {
    if (INSPECT) {
      await inspect(pool);
      return;
    }

    if (DRY_RUN) {
      log("🧪", REPORT_ONLY ? "حالت گزارش — چیزی در دیتابیس نوشته نمی‌شود" : "حالت آزمایشی — چیزی نوشته نمی‌شود");
    }
    if (RAW_AMOUNTS) log("💰", "مبالغ دست‌نخورده وارد می‌شوند");

    // ترتیب مهم است: مشتری و خدمت باید قبل از سابقه و نوبت باشند
    if (shouldRun("customers")) await importCustomers(pool);
    if (shouldRun("services") || shouldRun("visits") || shouldRun("appointments")) {
      await importServices(pool);
    }
    if (shouldRun("visits")) await importVisits(pool);
    if (shouldRun("appointments")) await importAppointments(pool);
    if (shouldRun("expenses")) await importExpenses(pool);
    if (shouldRun("staff")) await importStaff(pool);

    await backfillJoinDates();

    console.log();
    writeReport();

    console.log(`\n${DRY_RUN ? "🧪 اگر واقعی اجرا شود:" : "🎉 مهاجرت تمام شد:"}`);
    console.log(`   مشتری‌ها      ${toFa(stats.customers.created)} ثبت، ${toFa(stats.customers.merged)} یکی‌شده`);
    console.log(`   سابقه‌ها      ${toFa(stats.visits.created)} ثبت`);
    console.log(`   پرداخت‌ها     ${toFa(stats.payments.created)} ثبت (${toFa(stats.payments.amountFixed)} مبلغ اصلاح شد)`);
    console.log(`   نوبت‌ها       ${toFa(stats.appointments.created)} ثبت`);
    if (stats.expenses.created) console.log(`   هزینه‌ها      ${toFa(stats.expenses.created)} ثبت`);
    if (stats.staff.created) console.log(`   پرسنل        ${toFa(stats.staff.created)} ثبت`);

    if (DRY_RUN) {
      console.log("\n   برای اجرای واقعی: npm run import:legacy");
    }
  } finally {
    await pool.close();
    await prisma.$disconnect();
  }
}


main().catch((error) => {
  console.error("❌ مهاجرت با خطا متوقف شد:", error);
  process.exit(1);
});
