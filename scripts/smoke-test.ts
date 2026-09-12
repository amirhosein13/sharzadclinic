/**
 * تست دودی (smoke test) مسیر رزرو نوبت — بدون نیاز به مرورگر.
 * اجرا:  npm run test:smoke
 * دیتای تستی ساخته و در پایان پاک می‌شود.
 */
import "../src/lib/timezone";
import { PrismaClient } from "@prisma/client";
import { getAvailableSlots } from "../src/lib/availability";
import { createBooking, trackAppointment } from "../src/app/actions/booking";
import { atTime, parseYmdKey } from "../src/lib/date";
import { summarizePackages, activePackages } from "../src/lib/packages";
import { buildReport, resolveRange } from "../src/lib/reports";
import { normalizeSource, sourceLabel } from "../src/lib/referral-sources";
import {
  attachReferral, ensureReferralCode, qualifyReferrals, referralSummary, topReferrers,
} from "../src/lib/referrals";
import { checkDiscount, normalizeCode, redeemDiscount } from "../src/lib/discounts";
import { joinWaitlist } from "../src/app/actions/waitlist";
import { matchesForSlot } from "../src/lib/waitlist";
import { submitFeedback } from "../src/app/actions/feedback";
import { buildSatisfaction, newFeedbackToken } from "../src/lib/feedback";
import { buildDailyDigest } from "../src/lib/daily-digest";
import { buildDaySchedule } from "../src/lib/day-schedule";
import { buildProfit } from "../src/lib/expenses";
import { openTicket, replyAsCustomer } from "../src/app/actions/tickets";
import { customerUnreadCount, isUrgent } from "../src/lib/tickets";
import { generateFollowUps } from "../src/lib/followups";
import { checkLoginAllowed, recordFailedLogin, MAX_ATTEMPTS } from "../src/lib/login-guard";
import { issueResetCode, resetPasswordWithCode } from "../src/lib/password-reset";
import bcrypt from "bcryptjs";
import { searchEverything } from "../src/lib/search";
import { getSetupStatus } from "../src/lib/setup-status";
import { getAttentionItems } from "../src/lib/attention";
import { consumeForService, lowStockItems, recordMovement } from "../src/lib/inventory";
import { toFa } from "../src/lib/utils";
import { missingConsents } from "../src/lib/consents";
import { listAudit } from "../src/lib/audit";
import { buildHealth } from "../src/lib/health";
import { noShowCost, noShowProfile, noShowReport } from "../src/lib/no-shows";
import { activeClosure, closedWeekdaysText, upcomingClosures } from "../src/lib/closures";
import { buildUtilization } from "../src/lib/utilization";
import { buildSiteStats, pruneEvents, trackEvent } from "../src/lib/site-stats";
import { EVENTS } from "../src/lib/events";
import { WEEKDAYS_FA } from "../src/lib/date";
import { GUIDE, guideFor } from "../src/lib/guide";
import { can } from "../src/lib/permissions";
import { mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BACKUP_DIR, listBackups, pruneBackups } from "../src/lib/backup";
import {
  promoteToGallery, publishCandidates, withdrawPhotoConsent,
} from "../src/lib/photo-publish";
import {
  audienceWhere, decorateMessage, sendBatch, startCampaign,
} from "../src/lib/campaigns";
import { buildCashDay, closeCashDay, recentCloses, unclosedDays } from "../src/lib/cash";
import { cleanAmount, cleanDate, cleanPhone, normalizeName } from "./legacy-clean";
import { tidyRichText } from "../src/lib/rich-text";
import { meliErrorMessage } from "../src/lib/notifications/sms";

const prisma = new PrismaClient();

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

async function main() {
  let failures = 0;
  const check = (name: string, pass: boolean) => {
    console.log(`${pass ? "✅" : "❌"} ${name}`);
    if (!pass) failures++;
  };

  // اگر اجرای قبلی وسط کار خطا خورده باشد، ته‌مانده‌اش نباید اجرای بعدی را خراب کند
  await prisma.appointment.deleteMany({
    where: { OR: [{ source: "smoke" }, { customer: { phone: "09129998877" } }] },
  });
  await prisma.customer.deleteMany({ where: { phone: "09129998877" } });

  const service = await prisma.service.findUniqueOrThrow({ where: { slug: "laser" } });

  // روز ثابت («۵ روز بعد») بسته به اینکه تست چه روزی اجرا شود ممکن است روی
  // جمعه بیفتد و کلینیک تعطیل باشد. اولین روزی را برمی‌داریم که واقعاً وقت
  // خالی دارد، تا تست به روزِ هفته وابسته نباشد.
  let dateKey = "";
  let slots: Awaited<ReturnType<typeof getAvailableSlots>> = [];
  for (let offset = 3; offset <= 17; offset++) {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const found = await getAvailableSlots({ serviceId: service.id, dateKey: key });
    if (found.length > 0) {
      dateKey = key;
      slots = found;
      break;
    }
  }

  check(`محاسبه‌ی نوبت‌های خالی برای ${dateKey || "هیچ روزی"} (${slots.length} اسلات)`, slots.length > 0);
  if (slots.length === 0) process.exit(1);

  const res = await createBooking(fd({
    serviceId: service.id, dateKey, time: slots[0].time,
    firstName: "تست", lastName: "کاربر", phone: "۰۹۱۲۹۹۹۸۸۷۷", note: "تست خودکار",
  }));
  check("ثبت نوبت جدید", res.ok);
  if (!res.ok) {
    console.error(res);
    process.exit(1);
  }
  if (!("code" in res)) {
    console.error("انتظار می‌رفت نوبت مستقیم ثبت شود، نه هدایت به درگاه.", res);
    process.exit(1);
  }
  console.log(`   کد پیگیری: ${res.code} — ${res.summary}`);

  // همان اسلات دیگر نباید آزاد باشد
  const after = await getAvailableSlots({ serviceId: service.id, dateKey });
  check("اسلات رزروشده دیگر آزاد نیست (جلوگیری از رزرو تکراری)", !after.some((s) => s.time === slots[0].time));

  // پیگیری
  const t = await trackAppointment(null, fd({ code: res.code, phone: "09129998877" }));
  check("پیگیری نوبت با کد و شماره موبایل", t.ok && t.appointment.code === res.code);

  // ورودی نامعتبر
  const bad = await createBooking(fd({
    serviceId: service.id, dateKey, time: slots[1]?.time ?? "10:00",
    firstName: "ا", lastName: "", phone: "123",
  }));
  check("رد ورودی نامعتبر با پیام فارسی", !bad.ok && Object.keys(bad.errors ?? {}).length === 3);

  // ─── بافر بین نوبت‌ها ───
  // نوبت رزروشده باید علاوه بر مدت خودش، بافر بعدش را هم اشغال کند.
  await prisma.setting.upsert({
    where: { key: "slotStepMinutes" },
    create: { key: "slotStepMinutes", value: "15" },
    update: { value: "15" },
  });
  const fineGrained = await getAvailableSlots({ serviceId: service.id, dateKey });
  const booked = await prisma.appointment.findFirst({
    where: { customer: { phone: "09129998877" } },
    orderBy: { startsAt: "desc" },
  });
  const endMinutes = booked!.endsAt.getHours() * 60 + booked!.endsAt.getMinutes();
  const firstAfter = fineGrained
    .map((s) => Number(s.time.split(":")[0]) * 60 + Number(s.time.split(":")[1]))
    .filter((m) => m >= endMinutes)
    .sort((a, b) => a - b)[0];
  check(
    `بافر ${service.bufferMinutes} دقیقه‌ای بعد از نوبت رزروشده رعایت می‌شود`,
    firstAfter === undefined || firstAfter >= endMinutes + service.bufferMinutes
  );
  await prisma.setting.deleteMany({ where: { key: "slotStepMinutes" } });

  // ─── گام زمانی اختصاصی خدمت ───
  await prisma.service.update({ where: { id: service.id }, data: { slotStepMinutes: 60 } });
  const hourly = await getAvailableSlots({ serviceId: service.id, dateKey });
  check(
    "گام زمانی اختصاصی خدمت اعمال می‌شود (همه‌ی اسلات‌ها سر ساعت)",
    hourly.length > 0 && hourly.every((s) => s.time.endsWith(":00"))
  );
  await prisma.service.update({ where: { id: service.id }, data: { slotStepMinutes: null } });

  // ─── قفل نوبت هنگام پرداخت ───
  const holdSlot = (await getAvailableSlots({ serviceId: service.id, dateKey }))[2];
  const holdStart = atTime(parseYmdKey(dateKey), holdSlot.time);
  const held = await prisma.appointment.create({
    data: {
      code: "SMOKE-HOLD",
      customerId: (await prisma.customer.findFirstOrThrow({ where: { phone: "09129998877" } })).id,
      serviceId: service.id,
      staffId: holdSlot.staffId,
      startsAt: holdStart,
      endsAt: new Date(holdStart.getTime() + service.durationMinutes * 60_000),
      status: "PENDING",
      source: "smoke",
      holdExpiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });
  const whileHeld = await getAvailableSlots({ serviceId: service.id, dateKey });
  check(
    "نوبتِ قفل‌شده برای پرداخت، برای دیگران بسته است",
    !whileHeld.some((s) => s.time === holdSlot.time)
  );

  await prisma.appointment.update({
    where: { id: held.id },
    data: { holdExpiresAt: new Date(Date.now() - 60_000) },
  });
  const afterExpiry = await getAvailableSlots({ serviceId: service.id, dateKey });
  check(
    "قفل منقضی‌شده اسلات را آزاد می‌کند",
    afterExpiry.some((s) => s.time === holdSlot.time)
  );
  const released = await prisma.appointment.findUnique({ where: { id: held.id } });
  check("نوبت رهاشده خودکار لغو می‌شود", released?.status === "CANCELLED");

  // ── پکیج جلسات ──────────────────────────────────────────────
  const PKG_PHONE = "09125556677";
  await prisma.treatmentRecord.deleteMany({ where: { customer: { phone: PKG_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: PKG_PHONE } } });
  await prisma.package.deleteMany({ where: { customer: { phone: PKG_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: PKG_PHONE } });

  const pkgCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "پکیج", phone: PKG_PHONE },
  });
  const pkg = await prisma.package.create({
    data: {
      customerId: pkgCustomer.id,
      serviceId: service.id,
      title: "پکیج تست ۶ جلسه",
      totalSessions: 6,
      price: 9_000_000,
      paidAmount: 2_000_000,
    },
  });
  const addSession = (sessionNo: number, performedAt = new Date()) =>
    prisma.treatmentRecord.create({
      data: { customerId: pkgCustomer.id, serviceId: service.id, packageId: pkg.id, performedAt, sessionNo },
    });
  const pkgState = async () => (await summarizePackages(pkgCustomer.id)).find((p) => p.id === pkg.id)!;

  let ps = await pkgState();
  check(
    `پکیج تازه: ${ps.remainingSessions} جلسه و ${ps.remainingAmount} تومان مانده`,
    ps.usedSessions === 0 && ps.remainingSessions === 6 && ps.remainingAmount === 7_000_000
  );

  const s1 = await addSession(1);
  await addSession(2);
  await addSession(3);
  ps = await pkgState();
  check("شمارش جلسات پکیج از روی سابقه‌های واقعی", ps.usedSessions === 3 && ps.remainingSessions === 3);

  await prisma.treatmentRecord.delete({ where: { id: s1.id } });
  ps = await pkgState();
  check("حذف یک جلسه، باقی‌مانده‌ی پکیج را برمی‌گرداند", ps.usedSessions === 2 && ps.remainingSessions === 4);

  for (let i = 3; i <= 6; i++) await addSession(i);
  ps = await pkgState();
  check("پکیج پس از آخرین جلسه تمام‌شده می‌شود", ps.usedSessions === 6 && ps.remainingSessions === 0 && ps.isFinished);
  check("پکیج تمام‌شده در فهرست فعالِ مشتری نمی‌آید", (await activePackages(pkgCustomer.id)).length === 0);

  await addSession(7);
  ps = await pkgState();
  check("جلسه‌ی اضافه، باقی‌مانده را منفی نمی‌کند", ps.remainingSessions === 0);

  const expiredPkg = await prisma.package.create({
    data: {
      customerId: pkgCustomer.id,
      serviceId: service.id,
      title: "پکیج منقضی",
      totalSessions: 4,
      price: 4_000_000,
      paidAmount: 4_000_000,
      expiresAt: new Date(Date.now() - 86_400_000),
    },
  });
  const expiredState = (await summarizePackages(pkgCustomer.id)).find((p) => p.id === expiredPkg.id)!;
  check(
    "پکیج منقضی، نشانه‌گذاری و از فهرست فعال خارج می‌شود",
    expiredState.isExpired && !(await activePackages(pkgCustomer.id)).some((p) => p.id === expiredPkg.id)
  );

  await prisma.treatmentRecord.deleteMany({ where: { customerId: pkgCustomer.id } });
  await prisma.package.deleteMany({ where: { customerId: pkgCustomer.id } });
  await prisma.customer.delete({ where: { id: pkgCustomer.id } });

  // ── گزارش‌های مدیریتی ───────────────────────────────────────
  // بازه‌ای در گذشته‌ی دور انتخاب می‌کنیم تا داده‌ی واقعی کلینیک در آن نباشد
  const RP_PHONE = "09125554433";
  const rpFrom = new Date(2019, 0, 1, 0, 0, 0, 0);
  const rpTo = new Date(2019, 0, 31, 23, 59, 59, 999);
  const day = (d: number, h: number) => new Date(2019, 0, d, h, 0, 0, 0);

  await prisma.payment.deleteMany({ where: { customer: { phone: RP_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: RP_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: RP_PHONE } });

  const rpCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "گزارش", phone: RP_PHONE, createdAt: day(3, 9) },
  });
  const rpStaff = await prisma.staff.findFirstOrThrow();

  const makeAppt = async (d: number, h: number, status: "DONE" | "CANCELLED" | "CONFIRMED") =>
    prisma.appointment.create({
      data: {
        code: `SH-RP${d}${h}`,
        customerId: rpCustomer.id,
        serviceId: service.id,
        staffId: rpStaff.id,
        startsAt: day(d, h),
        endsAt: new Date(day(d, h).getTime() + 45 * 60_000),
        status,
        source: "smoke",
      },
    });

  const a1 = await makeAppt(5, 10, "DONE");
  const a2 = await makeAppt(9, 10, "DONE");
  await makeAppt(12, 16, "CANCELLED");
  await makeAppt(15, 11, "CONFIRMED"); // گذشته و هنوز تأیید‌شده ⇒ عدم مراجعه

  await prisma.payment.createMany({
    data: [
      { customerId: rpCustomer.id, appointmentId: a1.id, amount: 500_000, method: "CASH", status: "PAID", paidAt: day(5, 11) },
      { customerId: rpCustomer.id, appointmentId: a2.id, amount: 300_000, method: "CARD", status: "PAID", paidAt: day(9, 11) },
      { customerId: rpCustomer.id, amount: 1_000_000, method: "CARD", status: "PAID", paidAt: day(20, 12) },
      // این یکی نباید در درآمد بیاید
      { customerId: rpCustomer.id, amount: 999_000, method: "ONLINE", status: "PENDING", paidAt: null },
    ],
  });

  const report = await buildReport({ from: rpFrom, to: rpTo, label: "بازه‌ی تست" });

  check(
    `درآمد گزارش فقط از پرداخت‌های موفق (${report.revenue})`,
    report.revenue === 1_800_000 && report.paymentCount === 3
  );
  check(
    `تفکیک وضعیت نوبت‌ها (${report.appointments.done}/${report.appointments.cancelled}/${report.appointments.noShow})`,
    report.appointments.done === 2 &&
      report.appointments.cancelled === 1 &&
      report.appointments.noShow === 1 &&
      report.appointments.noShowRate === 25
  );
  const serviceRow = report.byService.find((r) => r.key === service.id);
  const looseRow = report.byService.find((r) => r.label.includes("بدون نوبت"));
  check(
    "درآمد به خدمتِ همان نوبت نسبت داده می‌شود",
    serviceRow?.revenue === 800_000 && serviceRow?.sessions === 2
  );
  check("پرداخت بدون نوبت جدا شمرده می‌شود", looseRow?.revenue === 1_000_000);
  check(
    "مشتری جدید و بازگشتی",
    report.customers.newCount === 1 &&
      report.customers.activeCount === 1 &&
      report.customers.returningCount === 0
  );
  check(
    "روش پرداخت تفکیک می‌شود",
    report.byMethod.find((m) => m.key === "CARD")?.revenue === 1_300_000 &&
      report.byMethod.find((m) => m.key === "CASH")?.revenue === 500_000
  );
  check("روند روزانه برای نمودار", report.daily.length === 3);

  await prisma.payment.deleteMany({ where: { customerId: rpCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: rpCustomer.id } });
  await prisma.customer.delete({ where: { id: rpCustomer.id } });

  // ── کد تخفیف ────────────────────────────────────────────────
  await prisma.discountUse.deleteMany({ where: { code: { code: { startsWith: "SMOKE" } } } });
  await prisma.discountCode.deleteMany({ where: { code: { startsWith: "SMOKE" } } });

  const dcCustomer = await prisma.customer.findFirstOrThrow();
  const dcOther = await prisma.customer.findFirstOrThrow({ where: { id: { not: dcCustomer.id } } });

  check("کد تخفیف یکدست می‌شود (فارسی و فاصله)", normalizeCode(" smoke۲۰ ") === "SMOKE20");

  const pct = await prisma.discountCode.create({
    data: {
      code: "SMOKE20",
      kind: "PERCENT",
      value: 20,
      maxDiscount: 100_000,
      minAmount: 200_000,
      maxUses: 2,
    },
  });
  const fixed = await prisma.discountCode.create({
    data: { code: "SMOKEFIX", kind: "FIXED", value: 500_000 },
  });
  const expiredCode = await prisma.discountCode.create({
    data: {
      code: "SMOKEOLD",
      kind: "FIXED",
      value: 50_000,
      expiresAt: new Date(Date.now() - 86_400_000),
    },
  });

  const below = await checkDiscount({ code: "smoke20", amount: 100_000 });
  check("کد زیر حداقل خرید رد می‌شود", !below.ok);

  const okPct = await checkDiscount({ code: "SMOKE20", amount: 300_000 });
  check(
    "تخفیف درصدی درست حساب می‌شود",
    okPct.ok && okPct.discount === 60_000 && okPct.finalAmount === 240_000
  );

  const capped = await checkDiscount({ code: "SMOKE20", amount: 2_000_000 });
  check("سقف تخفیف درصدی رعایت می‌شود", capped.ok && capped.discount === 100_000);

  const overFixed = await checkDiscount({ code: "SMOKEFIX", amount: 300_000 });
  check(
    "تخفیف ثابت از مبلغ خرید بیشتر نمی‌شود",
    overFixed.ok && overFixed.discount === 300_000 && overFixed.finalAmount === 0
  );

  const stale = await checkDiscount({ code: "SMOKEOLD", amount: 300_000 });
  check("کد منقضی‌شده رد می‌شود", !stale.ok);

  await redeemDiscount({ codeId: pct.id, customerId: dcCustomer.id, amount: 60_000 });
  const repeat = await checkDiscount({ code: "SMOKE20", amount: 300_000, customerId: dcCustomer.id });
  check("هر مشتری فقط یک بار از یک کد استفاده می‌کند", !repeat.ok);

  await redeemDiscount({ codeId: pct.id, customerId: dcOther.id, amount: 60_000 });
  const overCapacity = await redeemDiscount({
    codeId: pct.id,
    customerId: dcCustomer.id,
    amount: 60_000,
  });
  const afterUses = await prisma.discountCode.findUniqueOrThrow({ where: { id: pct.id } });
  check(
    "ظرفیت کل کد قابل دور زدن نیست",
    !overCapacity && afterUses.usedCount === 2
  );

  await prisma.discountUse.deleteMany({
    where: { codeId: { in: [pct.id, fixed.id, expiredCode.id] } },
  });
  await prisma.discountCode.deleteMany({ where: { code: { startsWith: "SMOKE" } } });

  // ── لیست انتظار ─────────────────────────────────────────────
  const WL_PHONE = "09125557788";
  await prisma.waitlistEntry.deleteMany({ where: { customer: { phone: WL_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: WL_PHONE } });

  const wlFromKey = dateKey;
  const wlTo = parseYmdKey(dateKey);
  wlTo.setDate(wlTo.getDate() + 10);
  const wlToKey = `${wlTo.getFullYear()}-${String(wlTo.getMonth() + 1).padStart(2, "0")}-${String(wlTo.getDate()).padStart(2, "0")}`;

  const joined = await joinWaitlist(fd({
    serviceId: service.id,
    firstName: "تست",
    lastName: "انتظار",
    phone: "۰۹۱۲۵۵۵۷۷۸۸",
    fromDate: wlFromKey,
    toDate: wlToKey,
    note: "فقط عصرها",
  }));
  check("ثبت لیست انتظار از سایت", joined.ok);

  const wlCustomer = await prisma.customer.findFirst({ where: { phone: WL_PHONE } });
  check("مشتری تازه برای لیست انتظار ساخته شد", !!wlCustomer);

  const again = await joinWaitlist(fd({
    serviceId: service.id,
    firstName: "تست",
    lastName: "انتظار",
    phone: "09125557788",
    fromDate: wlFromKey,
    toDate: wlToKey,
  }));
  const wlCount = await prisma.waitlistEntry.count({ where: { customerId: wlCustomer!.id } });
  check(`درخواست تکراری دوباره ثبت نمی‌شود (${wlCount} درخواست)`, again.ok && wlCount === 1);

  const reversed = await joinWaitlist(fd({
    serviceId: service.id,
    firstName: "تست",
    lastName: "انتظار",
    phone: "09125557788",
    fromDate: wlToKey,
    toDate: wlFromKey,
  }));
  check("بازه‌ی برعکس رد می‌شود", !reversed.ok);

  const inRange = await matchesForSlot(service.id, atTime(parseYmdKey(wlFromKey), "12:00"));
  check(
    "منتظرانِ همان خدمت در همان بازه پیدا می‌شوند",
    inRange.some((e) => e.customerId === wlCustomer!.id)
  );

  const outOfRange = await matchesForSlot(service.id, new Date(wlTo.getTime() + 30 * 86_400_000));
  check(
    "خارج از بازه‌ی مشتری پیشنهاد نمی‌شود",
    !outOfRange.some((e) => e.customerId === wlCustomer!.id)
  );

  await prisma.waitlistEntry.deleteMany({ where: { customerId: wlCustomer!.id } });
  await prisma.customer.delete({ where: { id: wlCustomer!.id } });

  // ── نظرسنجی و گزارش رضایت ──────────────────────────────────
  const FB_PHONE = "09125552211";
  await prisma.feedback.deleteMany({ where: { customer: { phone: FB_PHONE } } });
  await prisma.followUp.deleteMany({ where: { customer: { phone: FB_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: FB_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: FB_PHONE } });

  const fbCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "نظر", phone: FB_PHONE },
  });
  const fbStaff = await prisma.staff.findFirstOrThrow();
  const fbFrom = new Date(Date.now() - 3 * 86_400_000);
  const fbTo = new Date(Date.now() + 86_400_000);

  const makeInvite = async (label: string) =>
    prisma.feedback.create({
      data: {
        customerId: fbCustomer.id,
        serviceId: service.id,
        staffId: fbStaff.id,
        token: newFeedbackToken(),
        sentAt: new Date(),
      },
      select: { id: true, token: true },
    }).then((row) => ({ ...row, label }));

  const happy = await makeInvite("راضی");
  const angry = await makeInvite("ناراضی");
  const untouched = await makeInvite("بی‌پاسخ");

  const happyResult = await submitFeedback(fd({
    token: happy.token,
    rating: "۵",
    comment: "خیلی راضی بودم",
    wouldRecommend: "yes",
    canPublish: "on",
  }));
  check("ثبت نظر با ارقام فارسی", happyResult.ok);

  // تگ‌ها به‌صورت چندمقداری فرستاده می‌شوند
  const angryForm = new FormData();
  angryForm.set("token", angry.token);
  angryForm.set("rating", "2");
  angryForm.append("badTags", "waiting");
  angryForm.append("badTags", "price");
  angryForm.append("badTags", "__hack__"); // کلید ناشناخته باید دور ریخته شود
  angryForm.append("goodTags", "staff");
  angryForm.append("goodTags", "waiting"); // تضاد: هم خوب هم بد
  angryForm.set("comment", "خیلی معطل شدم");
  angryForm.set("wouldRecommend", "no");
  const angryResult = await submitFeedback(angryForm);
  check("ثبت نظر منفی", angryResult.ok);

  const angryRow = await prisma.feedback.findUniqueOrThrow({ where: { id: angry.id } });
  check(
    "تگ ناشناخته ذخیره نمی‌شود",
    !angryRow.badTags.includes("__hack__") && angryRow.badTags.length === 2
  );
  check(
    "یک جنبه هم‌زمان خوب و بد نمی‌ماند",
    angryRow.goodTags.includes("staff") && !angryRow.goodTags.includes("waiting")
  );

  const duplicate = await submitFeedback(fd({ token: happy.token, rating: "4" }));
  check("نظر تکراری با همان لینک ثبت نمی‌شود", !duplicate.ok);

  const badToken = await submitFeedback(fd({ token: "0".repeat(32), rating: "4" }));
  check("لینک نامعتبر رد می‌شود", !badToken.ok);

  const autoFollowUp = await prisma.followUp.count({
    where: { customerId: fbCustomer.id, status: "OPEN" },
  });
  check(`نارضایتی خودکار به فهرست پیگیری می‌رود (${autoFollowUp})`, autoFollowUp === 1);

  const sat = await buildSatisfaction(fbFrom, fbTo);
  check(
    `میانگین رضایت درست است (${sat.averageRating} از ${sat.responses} نظر)`,
    sat.responses >= 2 && sat.averageRating > 0
  );
  check(
    "دعوت‌نامه‌ی بی‌پاسخ در میانگین نمی‌آید ولی در نرخ پاسخ شمرده می‌شود",
    sat.invitesSent >= 3 && sat.responseRate < 100
  );
  check(
    "پرتکرارترین شکایت‌ها استخراج می‌شود",
    sat.complaints.some((c) => c.key === "waiting") && sat.complaints.some((c) => c.key === "price")
  );
  check("نارضایتی باز شمرده می‌شود", sat.openComplaints >= 1);

  await prisma.followUp.deleteMany({ where: { customerId: fbCustomer.id } });
  await prisma.feedback.deleteMany({ where: { customerId: fbCustomer.id } });
  await prisma.customer.delete({ where: { id: fbCustomer.id } });
  void untouched;

  // ── گزارش شبانه و برنامه‌ی روز ──────────────────────────────
  // روزی در گذشته‌ی دور، تا داده‌ی واقعی کلینیک قاطی نشود
  const DG_PHONE = "09125559911";
  const dgDay = new Date(2019, 5, 10, 0, 0, 0, 0);
  const dgAt = (h: number, min = 0) => new Date(2019, 5, 10, h, min, 0, 0);

  await prisma.payment.deleteMany({ where: { customer: { phone: DG_PHONE } } });
  await prisma.feedback.deleteMany({ where: { customer: { phone: DG_PHONE } } });
  await prisma.followUp.deleteMany({ where: { customer: { phone: DG_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: DG_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: DG_PHONE } });

  const dgCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "گزارش‌شبانه", phone: DG_PHONE, createdAt: dgAt(9) },
  });
  const dgStaff = await prisma.staff.findFirstOrThrow();

  const dgAppt = async (h: number, status: "DONE" | "CANCELLED" | "CONFIRMED", code: string) =>
    prisma.appointment.create({
      data: {
        code,
        customerId: dgCustomer.id,
        serviceId: service.id,
        staffId: dgStaff.id,
        startsAt: dgAt(h),
        endsAt: dgAt(h, 45),
        status,
        source: "smoke",
      },
    });

  const dgDone = await dgAppt(10, "DONE", "SH-DG01");
  await dgAppt(12, "DONE", "SH-DG02");
  await dgAppt(14, "CANCELLED", "SH-DG03");
  await dgAppt(16, "CONFIRMED", "SH-DG04"); // گذشته و تعیین‌تکلیف نشده ⇒ نیامد

  await prisma.payment.create({
    data: {
      customerId: dgCustomer.id,
      appointmentId: dgDone.id,
      amount: 850_000,
      method: "CARD",
      status: "PAID",
      paidAt: dgAt(11),
    },
  });
  await prisma.feedback.create({
    data: {
      customerId: dgCustomer.id,
      serviceId: service.id,
      token: newFeedbackToken(),
      rating: 2,
      goodTags: [],
      badTags: ["waiting"],
      status: "SUBMITTED",
      sentAt: dgAt(17),
      submittedAt: dgAt(18),
    },
  });

  const digest = await buildDailyDigest(dgDay);
  check(
    `گزارش شبانه: شمارش نوبت‌ها (${digest.appointments}/${digest.done}/${digest.noShow}/${digest.cancelled})`,
    digest.appointments === 4 && digest.done === 2 && digest.noShow === 1 && digest.cancelled === 1
  );
  check(`گزارش شبانه: دریافتی (${digest.revenue})`, digest.revenue === 850_000);
  check("گزارش شبانه: مشتری جدید و نظر ناراضی", digest.newCustomers === 1 && digest.unhappy === 1);
  check(
    "متن پیامک همه‌ی بخش‌ها را دارد",
    digest.message.includes("نوبت:") &&
      digest.message.includes("دریافتی:") &&
      digest.message.includes("نظر ناراضی") &&
      digest.message.includes("فردا:") &&
      !digest.isEmpty
  );

  const emptyDigest = await buildDailyDigest(new Date(2018, 0, 15));
  check("روز خالی پیامک نمی‌گیرد", emptyDigest.isEmpty);

  // برنامه‌ی روز، همان داده را ستون‌بندی می‌کند
  const board = await buildDaySchedule("2019-06-10");
  const dgColumn = board.columns.find((c) => c.staffId === dgStaff.id);
  check(
    `برنامه‌ی روز، نوبت‌ها را زیر پرسنل می‌چیند (${dgColumn?.blocks.length ?? 0})`,
    dgColumn?.blocks.length === 4
  );
  check(
    "بلوک‌ها ساعت درست دارند",
    dgColumn?.blocks[0]?.startMinute === 600 && dgColumn?.blocks[0]?.endMinute === 645
  );
  check(
    "بازه‌ی نمایش، همه‌ی نوبت‌ها را در بر می‌گیرد",
    board.fromMinute <= 600 && board.toMinute >= 16 * 60 + 45
  );

  await prisma.payment.deleteMany({ where: { customerId: dgCustomer.id } });
  await prisma.feedback.deleteMany({ where: { customerId: dgCustomer.id } });
  await prisma.followUp.deleteMany({ where: { customerId: dgCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: dgCustomer.id } });
  await prisma.customer.delete({ where: { id: dgCustomer.id } });

  // ── انبار، هزینه و سود ──────────────────────────────────────
  await prisma.serviceMaterial.deleteMany({ where: { item: { name: { startsWith: "تست‌کالا" } } } });
  await prisma.expense.deleteMany({ where: { title: { contains: "تست‌کالا" } } });
  await prisma.stockMovement.deleteMany({ where: { item: { name: { startsWith: "تست‌کالا" } } } });
  await prisma.inventoryItem.deleteMany({ where: { name: { startsWith: "تست‌کالا" } } });

  const item = await prisma.inventoryItem.create({
    data: { name: "تست‌کالا ژل", unit: "سی‌سی", minStock: 3, unitCost: 0 },
  });

  // خرید: موجودی بالا می‌رود، بهای واحد به‌روز می‌شود و هزینه ثبت می‌گردد
  await recordMovement({ itemId: item.id, kind: "IN", quantity: 10, unitCost: 200_000 });
  let stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`خرید انبار موجودی و بهای واحد را به‌روز می‌کند (${stock.stock})`, stock.stock === 10 && stock.unitCost === 200_000);

  const autoExpense = await prisma.expense.findFirst({
    where: { title: { contains: "تست‌کالا" } },
    include: { category: { select: { slug: true } } },
  });
  check(
    `خرید انبار خودکار هزینه ثبت می‌کند (${autoExpense?.amount})`,
    autoExpense?.amount === 2_000_000 && autoExpense.category.slug === "materials"
  );

  await recordMovement({ itemId: item.id, kind: "OUT", quantity: 2.5 });
  stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`مصرف از موجودی کم می‌کند (${stock.stock})`, stock.stock === 7.5);

  // مصرف بیشتر از موجودی نباید منفی شود
  await recordMovement({ itemId: item.id, kind: "OUT", quantity: 100 });
  stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`موجودی منفی نمی‌شود (${stock.stock})`, stock.stock === 0);

  // اصلاح شمارش: عدد واردشده موجودیِ نهایی است
  await recordMovement({ itemId: item.id, kind: "ADJUST", quantity: 0, absoluteStock: 4 });
  stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`اصلاح شمارش موجودی را روی عدد واقعی می‌گذارد (${stock.stock})`, stock.stock === 4);

  // بالای مرز هشدار (۴ > ۳) نباید هشدار بدهد
  const notLow = await lowStockItems();
  check("بالای مرز هشدار، هشداری داده نمی‌شود", !notLow.some((i) => i.id === item.id));

  // مصرف خودکار خدمت
  await prisma.serviceMaterial.create({ data: { serviceId: service.id, itemId: item.id, quantity: 1.5 } });
  const consumed = await consumeForService(service.id, "smoke-treatment-1");
  stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(`مصرف خودکار خدمت از انبار کم می‌کند (${stock.stock})`, consumed === 1 && stock.stock === 2.5);

  // حالا زیر مرز است (۲.۵ ≤ ۳) و باید هشدار بدهد
  const lows = await lowStockItems();
  check("زیر مرز هشدار، قلم در فهرست کمبود می‌آید", lows.some((i) => i.id === item.id));

  // ── سود، روی داده‌ی کنترل‌شده ───────────────────────────────
  const PR_PHONE = "09125553311";
  const prFrom = new Date(2017, 2, 1, 0, 0, 0, 0);
  const prTo = new Date(2017, 2, 31, 23, 59, 59, 999);
  const prAt = (d: number) => new Date(2017, 2, d, 11, 0, 0, 0);

  await prisma.payment.deleteMany({ where: { customer: { phone: PR_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: PR_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: PR_PHONE } });
  await prisma.expense.deleteMany({ where: { spentAt: { gte: prFrom, lte: prTo } } });

  const prCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "سود", phone: PR_PHONE },
  });
  const prStaff = await prisma.staff.findFirstOrThrow();
  // درصد پورسانت واقعی می‌گذاریم تا این بخشِ تست تهی نباشد
  const prevCommission = prStaff.commissionPercent;
  await prisma.staff.update({ where: { id: prStaff.id }, data: { commissionPercent: 20 } });
  await prisma.staffOnService.updateMany({
    where: { staffId: prStaff.id, serviceId: service.id },
    data: { commissionPercent: null },
  });
  const prAppt = await prisma.appointment.create({
    data: {
      code: "SH-PR01",
      customerId: prCustomer.id,
      serviceId: service.id,
      staffId: prStaff.id,
      startsAt: prAt(5),
      endsAt: new Date(prAt(5).getTime() + 45 * 60_000),
      status: "DONE",
      source: "smoke",
    },
  });
  await prisma.payment.create({
    data: {
      customerId: prCustomer.id,
      appointmentId: prAppt.id,
      amount: 1_000_000,
      method: "CASH",
      status: "PAID",
      paidAt: prAt(5),
    },
  });

  const rentCategory = await prisma.expenseCategory.findUniqueOrThrow({ where: { slug: "rent" } });
  await prisma.expense.create({
    data: { categoryId: rentCategory.id, title: "اجاره تست", amount: 400_000, spentAt: prAt(1) },
  });

  const profit = await buildProfit(prFrom, prTo);
  check(
    `سود = درآمد منهای هزینه (${profit.revenue} − ${profit.expenses} = ${profit.profit})`,
    profit.revenue === 1_000_000 && profit.expenses === 400_000 && profit.profit === 600_000
  );
  check(`حاشیه‌ی سود (${profit.margin}٪)`, profit.margin === 60);

  const profitRow = profit.byService.find((r) => r.serviceId === service.id);
  // ۱.۵ سی‌سی × ۲۰۰٬۰۰۰ = ۳۰۰٬۰۰۰ بهای مواد
  check(
    `بهای مواد هر جلسه در سود خدمت می‌آید (${profitRow?.materialCost})`,
    profitRow?.materialCost === 300_000 && profitRow.missingMaterials === false
  );
  check(
    `پورسانت ۲۰٪ در سود خدمت کم می‌شود (${profitRow?.commission})`,
    profitRow?.commission === 200_000
  );
  check(
    `سود خدمت = درآمد − مواد − پورسانت (${profitRow?.profit})`,
    profitRow?.profit === 1_000_000 - 300_000 - 200_000
  );

  await prisma.staff.update({ where: { id: prStaff.id }, data: { commissionPercent: prevCommission } });

  await prisma.serviceMaterial.deleteMany({ where: { itemId: item.id } });
  await prisma.expense.deleteMany({ where: { stockMovementId: { not: null } } });
  await prisma.stockMovement.deleteMany({ where: { itemId: item.id } });
  await prisma.inventoryItem.delete({ where: { id: item.id } });
  await prisma.payment.deleteMany({ where: { customerId: prCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: prCustomer.id } });
  await prisma.customer.delete({ where: { id: prCustomer.id } });
  await prisma.expense.deleteMany({ where: { spentAt: { gte: prFrom, lte: prTo } } });

  // ── پیگیری خودکار: پس از درمان و بازگردانی ──────────────────
  const FU_PHONE = "09125554477";
  await prisma.followUp.deleteMany({ where: { customer: { phone: FU_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: FU_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: FU_PHONE } });

  const fuCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "پیگیری", phone: FU_PHONE },
  });
  const fuStaff = await prisma.staff.findFirstOrThrow();
  const prevFollowUpDays = service.followUpDays;
  await prisma.service.update({ where: { id: service.id }, data: { followUpDays: 3 } });

  // جلسه‌ای که ۴ روز پیش انجام شده ⇒ باید پیگیری پس از درمان بسازد.
  // پنجره‌ی جست‌وجو [۶ روز پیش تا ۳ روز پیش] است و «۳ روز پیش» یعنی همین ساعت
  // در آن روز؛ پس اگر جلسه را دقیقاً ۳ روز پیش ساعت ۱۱ بگذاریم، هر شب بین
  // نیمه‌شب و ۱۱ صبح بیرون از پنجره می‌افتد و تست بی‌دلیل قرمز می‌شود.
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  fourDaysAgo.setHours(11, 0, 0, 0);
  await prisma.appointment.create({
    data: {
      code: "SH-FU01",
      customerId: fuCustomer.id,
      serviceId: service.id,
      staffId: fuStaff.id,
      startsAt: fourDaysAgo,
      endsAt: new Date(fourDaysAgo.getTime() + 45 * 60_000),
      status: "DONE",
      source: "smoke",
    },
  });

  const fu1 = await generateFollowUps();
  const postCareRows = await prisma.followUp.count({
    where: { customerId: fuCustomer.id, kind: "POST_CARE" },
  });
  check(`پیگیری پس از درمان ساخته شد (${fu1.postCare})`, postCareRows === 1);

  // اجرای دوباره نباید تکراری بسازد
  await generateFollowUps();
  const afterSecond = await prisma.followUp.count({
    where: { customerId: fuCustomer.id, kind: "POST_CARE" },
  });
  check("پیگیری پس از درمان تکراری ساخته نمی‌شود", afterSecond === 1);

  await prisma.service.update({ where: { id: service.id }, data: { followUpDays: prevFollowUpDays } });
  await prisma.followUp.deleteMany({ where: { customerId: fuCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: fuCustomer.id } });
  await prisma.customer.delete({ where: { id: fuCustomer.id } });

  // ── تیکت ────────────────────────────────────────────────────
  const TK_PHONE = "09125556644";
  await prisma.supportTicket.deleteMany({ where: { customer: { phone: TK_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: TK_PHONE } });

  const tkCustomer = await prisma.customer.create({
    data: { firstName: "تست", lastName: "تیکت", phone: TK_PHONE },
  });

  // بدون ورود مشتری نباید بشود تیکت باز کرد
  const anonymous = await openTicket(fd({ subject: "تست", category: "other", body: "سلام سلام" }));
  check("بدون ورود، تیکت باز نمی‌شود", !anonymous.ok);

  const ticket = await prisma.supportTicket.create({
    data: {
      customerId: tkCustomer.id,
      subject: "سؤال درباره‌ی مراقبت",
      category: "aftercare",
      messages: { create: { sender: "CUSTOMER", body: "بعد از لیزر می‌توانم استخر بروم؟" } },
    },
  });
  check(
    "تیکت تازه منتظر پاسخ ماست",
    ticket.status === "OPEN" && ticket.unreadByStaff && !ticket.unreadByCustomer
  );

  // پاسخ کارکنان به نشست ادمین نیاز دارد و در تست مرورگر بررسی می‌شود؛
  // این‌جا فقط چیزهایی را می‌سنجیم که به نشست وابسته نیستند.
  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId: ticket.id, sender: "STAFF", body: "تا ۴۸ ساعت بهتر است نروید." },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "ANSWERED", lastSender: "STAFF", unreadByStaff: false, unreadByCustomer: true },
    }),
  ]);

  check(
    "شمارنده‌ی «منتظر پاسخ ما» تیکتِ پاسخ‌داده‌شده را نمی‌شمارد",
    !(await prisma.supportTicket.findMany({ where: { unreadByStaff: true, status: { not: "CLOSED" } } }))
      .some((t) => t.id === ticket.id)
  );
  check("شمارنده‌ی خوانده‌نشده‌ی مشتری", (await customerUnreadCount(tkCustomer.id)) === 1);
  check("شکایتِ باز فوری علامت می‌خورد", isUrgent("complaint", "OPEN") && !isUrgent("other", "OPEN"));

  const messageCount = await prisma.ticketMessage.count({ where: { ticketId: ticket.id } });
  check(`گفت‌وگو دو پیام دارد (${messageCount})`, messageCount === 2);

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  // مشتری در گفت‌وگوی بسته نباید بتواند بنویسد
  const closedReply = await replyAsCustomer(fd({ ticketId: ticket.id, body: "یک سؤال دیگر" }));
  check("در گفت‌وگوی بسته پاسخ ثبت نمی‌شود", !closedReply.ok);

  await prisma.supportTicket.deleteMany({ where: { customerId: tkCustomer.id } });
  await prisma.customer.delete({ where: { id: tkCustomer.id } });


  // ── رضایت‌نامه‌ی مخصوص خدمت ─────────────────────────────────
  const CS_PHONE = "09129990033";
  await prisma.consentSignature.deleteMany({ where: { customer: { phone: CS_PHONE } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: CS_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: CS_PHONE } });
  await prisma.consentTemplate.deleteMany({ where: { slug: { startsWith: "smoke-consent" } } });

  const csCustomer = await prisma.customer.create({
    data: { firstName: "رضایت", lastName: "آزمایشی", phone: CS_PHONE },
  });
  const otherService = await prisma.service.findFirstOrThrow({
    where: { slug: "botox" },
  });

  // یکی مخصوص همان خدمتی که مشتری نوبت دارد، یکی مخصوص خدمت دیگر، یکی عمومی
  const tplLaser = await prisma.consentTemplate.create({
    data: {
      slug: "smoke-consent-laser",
      title: "رضایت‌نامه‌ی آزمایشی لیزر",
      body: "متن {{نام}}",
      services: { create: [{ serviceId: service.id }] },
    },
  });
  const tplOther = await prisma.consentTemplate.create({
    data: {
      slug: "smoke-consent-other",
      title: "رضایت‌نامه‌ی آزمایشی تزریق",
      body: "متن {{نام}}",
      services: { create: [{ serviceId: otherService.id }] },
    },
  });
  const tplGeneral = await prisma.consentTemplate.create({
    data: { slug: "smoke-consent-general", title: "رضایت‌نامه‌ی عمومی آزمایشی", body: "متن" },
  });

  const csStart = new Date(Date.now() + 2 * 86_400_000);
  const csAppt = await prisma.appointment.create({
    data: {
      code: "SMOKE-CS",
      customerId: csCustomer.id,
      serviceId: service.id,
      startsAt: csStart,
      endsAt: new Date(csStart.getTime() + 3_600_000),
      status: "CONFIRMED",
      source: "smoke",
    },
  });

  const miss1 = await missingConsents(csCustomer.id);
  check(
    "رضایت‌نامه‌ی مخصوص خدمتِ همین مشتری به‌عنوان امضانشده می‌آید",
    miss1.some((m) => m.templateId === tplLaser.id)
  );
  check(
    "رضایت‌نامه‌ی خدمتِ دیگر هشدار نمی‌سازد",
    !miss1.some((m) => m.templateId === tplOther.id)
  );
  check(
    "رضایت‌نامه‌ی عمومی هشدار نمی‌سازد",
    !miss1.some((m) => m.templateId === tplGeneral.id)
  );
  check("نوبت پیش‌رو علامت فوریت می‌خورد", miss1.find((m) => m.templateId === tplLaser.id)!.upcoming);

  // پس از امضا دیگر نباید هشدار بدهد
  await prisma.consentSignature.create({
    data: {
      templateId: tplLaser.id,
      customerId: csCustomer.id,
      fullName: "رضایت آزمایشی",
      bodySnapshot: "متن رضایت آزمایشی",
    },
  });
  const miss2 = await missingConsents(csCustomer.id);
  check("پس از امضا هشدار برداشته می‌شود", !miss2.some((m) => m.templateId === tplLaser.id));

  // تخته‌ی روز هم باید همین را بداند
  const csKey = `${csStart.getFullYear()}-${String(csStart.getMonth() + 1).padStart(2, "0")}-${String(csStart.getDate()).padStart(2, "0")}`;
  await prisma.consentSignature.deleteMany({ where: { customerId: csCustomer.id } });
  const csDay = await buildDaySchedule(csKey);
  const csBlock = csDay.columns.flatMap((c) => c.blocks).find((b) => b.id === csAppt.id);
  check(
    "تخته‌ی روز رضایت‌نامه‌ی امضانشده را نشان می‌دهد",
    !!csBlock && csBlock.needsConsent.includes("رضایت‌نامه‌ی آزمایشی لیزر")
  );

  await prisma.consentSignature.deleteMany({ where: { customerId: csCustomer.id } });
  await prisma.appointment.deleteMany({ where: { customerId: csCustomer.id } });
  await prisma.customer.delete({ where: { id: csCustomer.id } });
  await prisma.consentTemplate.deleteMany({ where: { slug: { startsWith: "smoke-consent" } } });

  // ── قفل ورود پس از تلاش‌های ناموفق ──────────────────────────
  const LG_EMAIL = "smoke-login@example.com";
  await prisma.auditLog.deleteMany({
    where: { action: { in: ["login", "login.failed"] }, detail: LG_EMAIL },
  });

  check("ابتدا ورود باز است", (await checkLoginAllowed(LG_EMAIL)).allowed);

  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) await recordFailedLogin(LG_EMAIL);
  check(
    `تا ${toFa(MAX_ATTEMPTS - 1)} تلاش ناموفق هنوز باز است`,
    (await checkLoginAllowed(LG_EMAIL)).allowed
  );

  await recordFailedLogin(LG_EMAIL);
  const locked = await checkLoginAllowed(LG_EMAIL);
  check(
    `پس از ${toFa(MAX_ATTEMPTS)} تلاش ناموفق قفل می‌شود`,
    !locked.allowed && locked.message.includes("دقیقه")
  );

  check(
    "قفل فقط برای همان ایمیل است",
    (await checkLoginAllowed("smoke-other@example.com")).allowed
  );

  await prisma.auditLog.create({
    data: { action: "login", entity: "User", detail: LG_EMAIL },
  });
  check("ورود موفق شمارنده را از نو شروع می‌کند", (await checkLoginAllowed(LG_EMAIL)).allowed);

  await prisma.auditLog.deleteMany({
    where: { action: { in: ["login", "login.failed"] }, detail: LG_EMAIL },
  });


  // ── بازیابی رمز پنل ─────────────────────────────────────────
  const RESET_EMAIL = "smoke-reset@example.com";
  const RESET_PHONE = "09129990044";
  await prisma.user.deleteMany({ where: { email: RESET_EMAIL } });
  await prisma.otpCode.deleteMany({ where: { phone: RESET_PHONE } });
  await prisma.auditLog.deleteMany({
    where: { action: { in: ["login", "login.failed"] }, detail: RESET_EMAIL },
  });

  const resetUser = await prisma.user.create({
    data: {
      email: RESET_EMAIL,
      name: "کاربر آزمایشی بازیابی",
      phone: RESET_PHONE,
      passwordHash: await bcrypt.hash("OldPassword123", 12),
      role: "RECEPTION",
    },
  });

  // ایمیلی که وجود ندارد نباید تفاوتی نشان بدهد
  const unknown = await issueResetCode("definitely-not-here@example.com");
  check("ایمیل ناشناس هم پاسخ یکسان می‌گیرد", unknown.ok && unknown.maskedPhone === null);

  const issued = await issueResetCode(RESET_EMAIL);
  check("کد بازیابی صادر می‌شود", issued.ok && !!issued.code);
  check(
    "شماره‌ی مقصد ماسک‌شده نشان داده می‌شود",
    issued.ok && !!issued.maskedPhone && issued.maskedPhone.includes("***")
  );
  check(
    "شماره‌ی کامل لو نمی‌رود",
    issued.ok && !issued.maskedPhone?.includes(toFa("999004"))
  );

  const code = issued.ok ? issued.code! : "";

  // کد اشتباه رد می‌شود و رمز عوض نمی‌شود
  const wrong = await resetPasswordWithCode(RESET_EMAIL, "000000", "BrandNewPass1");
  check("کد اشتباه رمز را عوض نمی‌کند", !wrong.ok);
  const stillOld = await prisma.user.findUniqueOrThrow({ where: { id: resetUser.id } });
  check(
    "رمز قدیمی هنوز معتبر است",
    await bcrypt.compare("OldPassword123", stillOld.passwordHash)
  );

  // حساب قفل‌شده باید بعد از بازیابی باز شود
  for (let i = 0; i < MAX_ATTEMPTS; i++) await recordFailedLogin(RESET_EMAIL);
  check("پیش از بازیابی، حساب قفل است", !(await checkLoginAllowed(RESET_EMAIL)).allowed);

  const done = await resetPasswordWithCode(RESET_EMAIL, code, "BrandNewPass1");
  check("با کد درست رمز عوض می‌شود", done.ok);

  const updated = await prisma.user.findUniqueOrThrow({ where: { id: resetUser.id } });
  check("رمز تازه نشسته است", await bcrypt.compare("BrandNewPass1", updated.passwordHash));
  check("رمز قدیمی دیگر کار نمی‌کند", !(await bcrypt.compare("OldPassword123", updated.passwordHash)));
  check("بازیابی رمز، قفل ورود را برمی‌دارد", (await checkLoginAllowed(RESET_EMAIL)).allowed);

  // همان کد نباید دوباره کار کند
  const replay = await resetPasswordWithCode(RESET_EMAIL, code, "AnotherPass123");
  check("کد مصرف‌شده دوباره کار نمی‌کند", !replay.ok);

  // کاربر بدون موبایل نباید کد بگیرد
  await prisma.user.update({ where: { id: resetUser.id }, data: { phone: null } });
  const noPhone = await issueResetCode(RESET_EMAIL);
  check("کاربر بدون موبایل کد نمی‌گیرد", noPhone.ok && noPhone.maskedPhone === null);

  await prisma.otpCode.deleteMany({ where: { phone: RESET_PHONE } });
  await prisma.auditLog.deleteMany({ where: { detail: RESET_EMAIL } });
  await prisma.user.delete({ where: { id: resetUser.id } });




  // ── «از کجا با ما آشنا شدید» ────────────────────────────────
  const SRC_PHONES = ["09129990061", "09129990062", "09129990063", "09129990064"];
  await prisma.payment.deleteMany({ where: { customer: { phone: { in: SRC_PHONES } } } });
  await prisma.customer.deleteMany({ where: { phone: { in: SRC_PHONES } } });

  check("منبع نامعتبر ذخیره نمی‌شود", normalizeSource("hacker-value") === null);
  check("منبع معتبر پذیرفته می‌شود", normalizeSource("instagram") === "instagram");
  check("برچسب فارسی منبع", sourceLabel("friend") === "معرفی دوست یا آشنا");
  check("منبع خالی «نامشخص» می‌شود", sourceLabel(null) === "نامشخص");

  const srcRange = resolveRange("this-month");
  const srcMoment = new Date(Math.max(srcRange.from.getTime(), Date.now() - 3600_000));

  // دو نفر از اینستاگرام، یکی از معرفی دوست، یکی بدون جواب
  const srcCustomers = await Promise.all(
    [
      { phone: SRC_PHONES[0], referralSource: "instagram", pay: 1_000_000 },
      { phone: SRC_PHONES[1], referralSource: "instagram", pay: 3_000_000 },
      { phone: SRC_PHONES[2], referralSource: "friend", pay: 500_000 },
      { phone: SRC_PHONES[3], referralSource: null, pay: 0 },
    ].map(async (row) => {
      const c = await prisma.customer.create({
        data: {
          firstName: "منبع",
          lastName: "آزمایشی",
          phone: row.phone,
          referralSource: row.referralSource,
          createdAt: srcMoment,
        },
      });
      if (row.pay > 0) {
        await prisma.payment.create({
          data: {
            customerId: c.id,
            amount: row.pay,
            method: "CASH",
            status: "PAID",
            paidAt: srcMoment,
          },
        });
      }
      return c;
    }),
  );

  const srcReport = await buildReport(srcRange);
  const instagram = srcReport.bySource.find((r) => r.key === "instagram");
  const friend = srcReport.bySource.find((r) => r.key === "friend");
  const srcUnknown = srcReport.bySource.find((r) => r.key === "unknown");

  check("مشتریان هر کانال شمرده می‌شوند", instagram?.newCustomers === 2);
  check(
    `درآمد کانال جمع پرداخت‌های همان آدم‌هاست (${instagram?.revenue})`,
    instagram?.revenue === 4_000_000
  );
  check("کانال دوم هم درست است", friend?.newCustomers === 1 && friend?.revenue === 500_000);
  check(
    "کسانی که نپرسیده‌ایم جدا شمرده می‌شوند",
    (srcUnknown?.newCustomers ?? 0) >= 1
  );
  check("برچسب «نپرسیده‌ایم» می‌خورد", srcUnknown?.label === "نپرسیده‌ایم");
  check(
    "کانالِ پرمشتری‌تر بالاتر می‌آید",
    srcReport.bySource[0]?.key === "instagram"
  );
  check(
    "«نپرسیده‌ایم» همیشه آخر فهرست است",
    srcReport.bySource[srcReport.bySource.length - 1]?.key === "unknown"
  );
  check(
    "سهم درصدی جمعش صد است",
    srcReport.bySource.reduce((sum, r) => sum + r.share, 0) === 100
  );

  // رزرو آنلاین باید منبع را روی پرونده‌ی تازه بنشاند
  const srcSlots = await getAvailableSlots({ serviceId: service.id, dateKey });
  const srcBooking = await createBooking(fd({
    serviceId: service.id, dateKey, time: srcSlots[0].time,
    firstName: "تازه", lastName: "وارد", phone: "09129990065",
    referralSource: "google",
  }));
  check("رزرو با منبع ثبت می‌شود", srcBooking.ok);
  const bookedCustomer = await prisma.customer.findFirst({ where: { phone: "09129990065" } });
  check("منبع روی پرونده‌ی مشتری تازه نشست", bookedCustomer?.referralSource === "google");

  // رزرو دوم نباید جواب اول را بازنویسی کند
  const srcSlots2 = await getAvailableSlots({ serviceId: service.id, dateKey });
  await createBooking(fd({
    serviceId: service.id, dateKey, time: srcSlots2[0].time,
    firstName: "تازه", lastName: "وارد", phone: "09129990065",
    referralSource: "instagram",
  }));
  const srcAfterSecond = await prisma.customer.findFirst({ where: { phone: "09129990065" } });
  check("رزرو بعدی جواب اولیه را عوض نمی‌کند", srcAfterSecond?.referralSource === "google");

  await prisma.appointment.deleteMany({ where: { customer: { phone: "09129990065" } } });
  await prisma.customer.deleteMany({ where: { phone: "09129990065" } });
  await prisma.payment.deleteMany({ where: { customerId: { in: srcCustomers.map((c) => c.id) } } });
  await prisma.customer.deleteMany({ where: { id: { in: srcCustomers.map((c) => c.id) } } });


  // ── کد معرف ─────────────────────────────────────────────────
  const REF_PHONES = ["09129990071", "09129990072", "09129990073"];
  await prisma.referral.deleteMany({
    where: { OR: [{ referrer: { phone: { in: REF_PHONES } } }, { referred: { phone: { in: REF_PHONES } } }] },
  });
  await prisma.appointment.deleteMany({ where: { customer: { phone: { in: REF_PHONES } } } });
  await prisma.customer.deleteMany({ where: { phone: { in: REF_PHONES } } });
  await prisma.discountCode.deleteMany({ where: { note: { contains: "هدیه‌ی" } } });

  const prevReferral = await prisma.setting.findUnique({ where: { key: "referralEnabled" } });
  await prisma.setting.upsert({
    where: { key: "referralEnabled" },
    create: { key: "referralEnabled", value: "1" },
    update: { value: "1" },
  });

  const referrer = await prisma.customer.create({
    data: { firstName: "معرف", lastName: "آزمایشی", phone: REF_PHONES[0] },
  });
  const referred = await prisma.customer.create({
    data: { firstName: "معرفی‌شده", lastName: "آزمایشی", phone: REF_PHONES[1] },
  });
  const oldCustomer = await prisma.customer.create({
    data: { firstName: "قدیمی", lastName: "آزمایشی", phone: REF_PHONES[2] },
  });

  const refCode = await ensureReferralCode(referrer.id);
  check(`کد معرف ساخته می‌شود (${refCode})`, /^SH[A-Z0-9]{5}$/.test(refCode));
  check("کد معرف ثابت می‌ماند", (await ensureReferralCode(referrer.id)) === refCode);

  // کد خودش را نمی‌تواند استفاده کند
  const selfUse = await attachReferral({ referredId: referrer.id, code: refCode });
  check("کد معرف خودی رد می‌شود", !selfUse.ok);

  // کد نامعتبر
  const badCode = await attachReferral({ referredId: referred.id, code: "SHZZZZZ" });
  check("کد معرف نامعتبر رد می‌شود", !badCode.ok);

  // مشتری قدیمی (که سابقه‌ی مراجعه دارد) نباید معرفی‌شده حساب شود
  const oldStart = new Date(Date.now() - 10 * 86_400_000);
  await prisma.appointment.create({
    data: {
      code: "SMOKE-REF-OLD",
      customerId: oldCustomer.id,
      serviceId: service.id,
      startsAt: oldStart,
      endsAt: new Date(oldStart.getTime() + 3_600_000),
      status: "DONE",
      source: "smoke",
    },
  });
  const oldAttach = await attachReferral({ referredId: oldCustomer.id, code: refCode });
  check("مشتری با سابقه‌ی مراجعه معرفی‌شده حساب نمی‌شود", !oldAttach.ok);

  // معرفی معتبر
  const good = await attachReferral({ referredId: referred.id, code: refCode });
  check("معرفی معتبر ثبت می‌شود", good.ok);

  // دوباره نمی‌شود
  const twice = await attachReferral({ referredId: referred.id, code: refCode });
  check("یک نفر دو بار معرفی‌شده نمی‌شود", !twice.ok);

  // تا جلسه انجام نشده، هدیه‌ای صادر نمی‌شود
  const early = await qualifyReferrals();
  check("پیش از انجام جلسه هدیه صادر نمی‌شود", early.rewarded === 0);
  const stillPending = await prisma.referral.findUniqueOrThrow({ where: { referredId: referred.id } });
  check("وضعیت هنوز «در انتظار» است", stillPending.status === "PENDING");

  // حالا جلسه انجام می‌شود
  const refStart = new Date(Date.now() - 86_400_000);
  await prisma.appointment.create({
    data: {
      code: "SMOKE-REF-DONE",
      customerId: referred.id,
      serviceId: service.id,
      startsAt: refStart,
      endsAt: new Date(refStart.getTime() + 3_600_000),
      status: "DONE",
      source: "smoke",
    },
  });

  const qualified = await qualifyReferrals();
  check(`پس از اولین جلسه، هدیه صادر می‌شود (${qualified.rewarded})`, qualified.rewarded === 1);

  const rewarded = await prisma.referral.findUniqueOrThrow({ where: { referredId: referred.id } });
  check("وضعیت به «هدیه صادر شد» می‌رود", rewarded.status === "REWARDED");
  check("کد هدیه‌ی معرف ساخته شد", !!rewarded.referrerRewardCode);
  check("کد هدیه‌ی معرفی‌شده هم ساخته شد", !!rewarded.referredRewardCode);

  // کد هدیه باید واقعاً کار کند و یک‌بارمصرف باشد
  const gift = await prisma.discountCode.findUniqueOrThrow({
    where: { code: rewarded.referrerRewardCode! },
  });
  check("کد هدیه یک‌بارمصرف است", gift.maxUses === 1);
  check("کد هدیه تاریخ انقضا دارد", !!gift.expiresAt && gift.expiresAt > new Date());
  const giftCheck = await checkDiscount({ code: gift.code, amount: 2_000_000 });
  check("کد هدیه واقعاً تخفیف می‌دهد", giftCheck.ok && giftCheck.discount === gift.value);

  // اجرای دوباره نباید هدیه‌ی تکراری بدهد
  const refAgain = await qualifyReferrals();
  check("اجرای دوباره هدیه‌ی تکراری نمی‌دهد", refAgain.rewarded === 0);

  // خلاصه‌ی معرف
  const summary = await referralSummary(referrer.id);
  check("خلاصه‌ی معرف درست است", summary?.total === 1 && summary?.rewarded === 1);
  check("متن دعوت شامل کد است", !!summary?.shareText.includes(refCode));

  // معرف‌های برتر
  const leaders = await topReferrers(10);
  check(
    "معرف در فهرست معرف‌های برتر می‌آید",
    leaders.some((l) => l.id === referrer.id && l.rewarded === 1)
  );

  // وقتی خاموش است، هیچ‌کدام کار نمی‌کنند
  await prisma.setting.update({ where: { key: "referralEnabled" }, data: { value: "0" } });
  const offAttach = await attachReferral({ referredId: oldCustomer.id, code: refCode });
  check("وقتی خاموش است معرفی ثبت نمی‌شود", !offAttach.ok);
  check("وقتی خاموش است خلاصه‌ای نشان داده نمی‌شود", (await referralSummary(referrer.id)) === null);

  if (prevReferral) {
    await prisma.setting.update({ where: { key: "referralEnabled" }, data: { value: prevReferral.value } });
  } else {
    await prisma.setting.deleteMany({ where: { key: "referralEnabled" } });
  }
  await prisma.discountCode.deleteMany({
    where: { code: { in: [rewarded.referrerRewardCode!, rewarded.referredRewardCode!] } },
  });
  await prisma.referral.deleteMany({ where: { referrerId: referrer.id } });
  await prisma.appointment.deleteMany({
    where: { customerId: { in: [referrer.id, referred.id, oldCustomer.id] } },
  });
  await prisma.customer.deleteMany({
    where: { id: { in: [referrer.id, referred.id, oldCustomer.id] } },
  });


  // ── پیامک گروهی ─────────────────────────────────────────────
  const CAMP_PHONES = ["09129990081", "09129990082", "09129990083", "09129990084"];
  await prisma.campaignRecipient.deleteMany({
    where: { customer: { phone: { in: CAMP_PHONES } } },
  });
  await prisma.campaign.deleteMany({ where: { title: { startsWith: "SMOKE-CAMP" } } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: { in: CAMP_PHONES } } } });
  await prisma.customer.deleteMany({ where: { phone: { in: CAMP_PHONES } } });

  // خدمتِ مخصوص همین تست: اگر از خدمات واقعی استفاده کنیم، هر مشتری واقعی
  // که آن خدمت را گرفته وارد گروهِ کمپین می‌شود و تست دیگر ایزوله نیست
  await prisma.service.deleteMany({ where: { slug: { startsWith: "smoke-camp-" } } });
  const campService = await prisma.service.create({
    data: {
      slug: "smoke-camp-a",
      title: "SMOKE-CAMP خدمت الف",
      categoryId: service.categoryId,
      isActive: false,
      isBookable: false,
    },
  });
  const campOtherService = await prisma.service.create({
    data: {
      slug: "smoke-camp-b",
      title: "SMOKE-CAMP خدمت ب",
      categoryId: service.categoryId,
      isActive: false,
      isBookable: false,
    },
  });
  const longAgo = new Date();
  longAgo.setMonth(longAgo.getMonth() - 8);
  const recently = new Date(Date.now() - 5 * 86_400_000);

  // ۱: لیزر، خیلی وقت است نیامده  ← باید بیاید
  // ۲: لیزر، تازه آمده             ← با فیلتر «۶ ماه» نباید بیاید
  // ۳: بوتاکس، خیلی وقت است نیامده ← با فیلتر لیزر نباید بیاید
  // ۴: لیزر، خیلی وقت است نیامده، ولی انصراف داده ← هیچ‌وقت نباید بیاید
  const campCustomers = await Promise.all(
    [
      { phone: CAMP_PHONES[0], serviceId: campService.id, when: longAgo, optOut: false },
      { phone: CAMP_PHONES[1], serviceId: campService.id, when: recently, optOut: false },
      { phone: CAMP_PHONES[2], serviceId: campOtherService.id, when: longAgo, optOut: false },
      { phone: CAMP_PHONES[3], serviceId: campService.id, when: longAgo, optOut: true },
    ].map(async (row, index) => {
      const c = await prisma.customer.create({
        data: {
          firstName: "گروهی",
          lastName: `آزمایشی${index}`,
          phone: row.phone,
          smsOptOut: row.optOut,
        },
      });
      await prisma.appointment.create({
        data: {
          code: `SMOKE-CAMP${index}`,
          customerId: c.id,
          serviceId: row.serviceId,
          startsAt: row.when,
          endsAt: new Date(row.when.getTime() + 3_600_000),
          status: "DONE",
          source: "smoke",
        },
      });
      return c;
    }),
  );
  const campIds = campCustomers.map((c) => c.id);
  const inGroup = async (filter: Parameters<typeof audienceWhere>[0]) => {
    const rows = await prisma.customer.findMany({
      where: { AND: [audienceWhere(filter), { id: { in: campIds } }] },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  };

  const laserInactive = await inGroup({ serviceId: campService.id, inactiveMonths: 6 });
  check("مشتریِ همان خدمت که مدت‌هاست نیامده انتخاب می‌شود", laserInactive.has(campIds[0]));
  check("مشتریِ تازه‌آمده در فیلتر «۶ ماه» نمی‌آید", !laserInactive.has(campIds[1]));
  check("مشتریِ خدمت دیگر انتخاب نمی‌شود", !laserInactive.has(campIds[2]));
  check("کسی که انصراف داده هرگز انتخاب نمی‌شود", !laserInactive.has(campIds[3]));

  const everyone = await inGroup({ onlyWithVisits: true });
  check("بدون فیلتر خدمت، بقیه هم می‌آیند", everyone.has(campIds[1]) && everyone.has(campIds[2]));
  check("انصراف حتی بدون فیلتر هم رعایت می‌شود", !everyone.has(campIds[3]));

  // مشتریِ محدودشده هم نباید بیاید
  await prisma.customer.update({ where: { id: campIds[0] }, data: { isBlocked: true } });
  check("مشتری محدودشده انتخاب نمی‌شود", !(await inGroup({ onlyWithVisits: true })).has(campIds[0]));
  await prisma.customer.update({ where: { id: campIds[0] }, data: { isBlocked: false } });

  // متن باید راهنمای انصراف بگیرد
  const decorated = await decorateMessage("سلام، این ماه تخفیف داریم");
  check("راهنمای انصراف به متن اضافه می‌شود", decorated.includes("انصراف از پیامک"));

  // ساخت و اجرای یک کمپین واقعی روی همین گروه
  const campaign = await prisma.campaign.create({
    data: {
      title: "SMOKE-CAMP آزمایشی",
      message: decorated,
      serviceId: campService.id,
      inactiveMonths: 6,
    },
  });

  const started = await startCampaign(campaign.id);
  check("شروع کمپین گیرنده‌ها را قفل می‌کند", started.ok);

  const queued = await prisma.campaignRecipient.findMany({
    where: { campaignId: campaign.id },
    select: { customerId: true },
  });
  const queuedIds = new Set(queued.map((r) => r.customerId));
  check("فقط افراد واجد شرایط در صف‌اند", queuedIds.has(campIds[0]) && !queuedIds.has(campIds[3]));

  // شروع دوباره نباید ممکن باشد
  const restart = await startCampaign(campaign.id);
  check("کمپینِ شروع‌شده دوباره شروع نمی‌شود", !restart.ok);

  const batch = await sendBatch(campaign.id, 50);
  check(`دسته‌ی اول فرستاده شد (${batch.sent})`, batch.sent >= 1);
  check("چیزی در صف نماند", batch.remaining === 0);

  const finished = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
  check("کمپین تمام‌شده علامت می‌خورد", finished.status === "DONE");
  check("شمارش ارسال ثبت شد", finished.sent === batch.sent);

  // اجرای دوباره نباید کسی را دوباره پیامک کند
  const rerun = await sendBatch(campaign.id, 50);
  check("اجرای دوباره پیامک تکراری نمی‌فرستد", rerun.sent === 0);

  // انصراف بعد از قفل‌شدن فهرست هم باید رعایت شود
  const campaign2 = await prisma.campaign.create({
    data: { title: "SMOKE-CAMP دوم", message: decorated, serviceId: campService.id },
  });
  await startCampaign(campaign2.id);
  await prisma.customer.update({ where: { id: campIds[1] }, data: { smsOptOut: true } });
  await sendBatch(campaign2.id, 100);
  const lateOptOut = await prisma.campaignRecipient.findFirst({
    where: { campaignId: campaign2.id, customerId: campIds[1] },
  });
  check(
    "انصرافِ بعد از قفل‌شدن فهرست هم رعایت می‌شود",
    lateOptOut?.status === "failed" && lateOptOut.error === "انصراف از پیامک تبلیغاتی"
  );

  await prisma.campaignRecipient.deleteMany({
    where: { campaignId: { in: [campaign.id, campaign2.id] } },
  });
  await prisma.campaign.deleteMany({ where: { title: { startsWith: "SMOKE-CAMP" } } });
  await prisma.notificationLog.deleteMany({ where: { recipient: { in: CAMP_PHONES } } });
  await prisma.appointment.deleteMany({ where: { customerId: { in: campIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: campIds } } });
  await prisma.service.deleteMany({ where: { slug: { startsWith: "smoke-camp-" } } });


  // ── سلامت سیستم ────────────────────────────────────────────
  const health = await buildHealth();
  const healthChecks = health.groups.flatMap((g) => g.checks);
  check("گزارش سلامت چند دسته دارد", health.groups.length >= 5);
  check("هر بررسی عنوان و وضعیت دارد", healthChecks.every((c) => !!c.title && !!c.detail));
  check(
    "سطح‌ها فقط سه حالت دارند",
    healthChecks.every((c) => ["ok", "warn", "bad"].includes(c.level))
  );
  check(
    "هر مورد غیرسالم می‌گوید چه اتفاقی می‌افتد",
    healthChecks.filter((c) => c.level === "bad").every((c) => !!c.impact)
  );
  check(
    "شمارش مشکل‌ها با خود بررسی‌ها می‌خواند",
    health.bad === healthChecks.filter((c) => c.level === "bad").length &&
      health.warn === healthChecks.filter((c) => c.level === "warn").length
  );
  check("دیتابیس سالم گزارش می‌شود", healthChecks.find((c) => c.key === "db")?.level === "ok");
  check(
    "منطقه‌ی زمانی درست تشخیص داده می‌شود",
    healthChecks.find((c) => c.key === "timezone")?.level === "ok"
  );


  // ── اجازه‌ی انتشار عکس قبل/بعد ──────────────────────────────
  const PH_PHONE = "09129990091";
  await prisma.galleryItem.deleteMany({ where: { treatmentId: { not: null } } });
  await prisma.treatmentRecord.deleteMany({ where: { customer: { phone: PH_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: PH_PHONE } });

  const phCustomer = await prisma.customer.create({
    data: { firstName: "عکس", lastName: "آزمایشی", phone: PH_PHONE },
  });
  const phTreatment = await prisma.treatmentRecord.create({
    data: {
      customerId: phCustomer.id,
      serviceId: service.id,
      performedAt: new Date(Date.now() - 86_400_000),
      beforePhoto: "/api/files/smoke-before.jpg",
      afterPhoto: "/api/files/smoke-after.jpg",
    },
  });

  // بدون اجازه، اصلاً نامزد انتشار نیست
  const noConsent = await publishCandidates(50);
  check(
    "بدون اجازه، عکس نامزد انتشار نمی‌شود",
    !noConsent.some((c) => c.treatmentId === phTreatment.id)
  );
  const blocked = await promoteToGallery(phTreatment.id);
  check("بدون اجازه، افزودن به گالری رد می‌شود", !blocked.ok);

  // با اجازه
  await prisma.customer.update({
    where: { id: phCustomer.id },
    data: { photoPublishAllowed: true },
  });
  const withConsent = await publishCandidates(50);
  check(
    "با اجازه، عکس در فهرست نامزدها می‌آید",
    withConsent.some((c) => c.treatmentId === phTreatment.id)
  );

  const promoted = await promoteToGallery(phTreatment.id);
  check("افزودن به گالری انجام می‌شود", promoted.ok);

  const galleryItem = await prisma.galleryItem.findUniqueOrThrow({
    where: { treatmentId: phTreatment.id },
  });
  check("نمونه‌کار به‌صورت منتشرنشده ساخته می‌شود", galleryItem.isPublished === false);
  check("عنوان نام مشتری را لو نمی‌دهد", !galleryItem.title.includes("عکس آزمایشی"));
  check("هر دو عکس ثبت شده‌اند", !!galleryItem.beforeImage && !!galleryItem.afterImage);

  // دوباره اضافه نمی‌شود
  const phDuplicate = await promoteToGallery(phTreatment.id);
  check("پرونده دو بار به گالری اضافه نمی‌شود", !phDuplicate.ok);
  const afterPromote = await publishCandidates(50);
  check(
    "پرونده‌ی اضافه‌شده دیگر در فهرست نامزدها نیست",
    !afterPromote.some((c) => c.treatmentId === phTreatment.id)
  );

  // پس‌گرفتن اجازه باید عکس منتشرشده را از سایت بردارد
  await prisma.galleryItem.update({
    where: { id: galleryItem.id },
    data: { isPublished: true },
  });
  const hidden = await withdrawPhotoConsent(phCustomer.id);
  check(`پس‌گرفتن اجازه، عکس را از سایت برمی‌دارد (${hidden})`, hidden === 1);
  const afterWithdraw = await prisma.galleryItem.findUniqueOrThrow({
    where: { id: galleryItem.id },
  });
  check("عکس دیگر منتشر نیست", afterWithdraw.isPublished === false);
  const revoked = await prisma.customer.findUniqueOrThrow({ where: { id: phCustomer.id } });
  check("وضعیت مشتری به «اجازه نداده» برمی‌گردد", revoked.photoPublishAllowed === false);

  await prisma.galleryItem.deleteMany({ where: { treatmentId: phTreatment.id } });
  await prisma.treatmentRecord.deleteMany({ where: { customerId: phCustomer.id } });
  await prisma.customer.delete({ where: { id: phCustomer.id } });


  // ── راهنمای کاربری ──────────────────────────────────────────
  const adminGuide = guideFor((permission) => can("ADMIN", permission));
  const receptionGuide = guideFor((permission) => can("RECEPTION", permission));
  const operatorGuide = guideFor((permission) => can("OPERATOR", permission));

  const cardsOf = (g: typeof adminGuide) => g.flatMap((s) => s.cards);
  check("راهنما چند بخش دارد", adminGuide.length >= 8);
  check("مدیر همه‌ی بخش‌ها را می‌بیند", cardsOf(adminGuide).length === GUIDE.flatMap((s) => s.cards).length);
  check(
    "منشی راهنمای حقوق و پشتیبان را نمی‌بیند",
    !cardsOf(receptionGuide).some((c) => ["payroll", "backup", "users", "audit"].includes(c.id))
  );
  check(
    "منشی راهنمای کارهای خودش را می‌بیند",
    cardsOf(receptionGuide).some((c) => c.id === "day") &&
      cardsOf(receptionGuide).some((c) => c.id === "new-customer")
  );
  check("اپراتور هم راهنمای پایه را دارد", cardsOf(operatorGuide).some((c) => c.id === "login"));
  check(
    "بخش عیب‌یابی برای همه هست",
    operatorGuide.some((s) => s.id === "troubleshoot") &&
      receptionGuide.some((s) => s.id === "troubleshoot")
  );
  check(
    "هیچ بخش خالی‌ای نمی‌ماند",
    [adminGuide, receptionGuide, operatorGuide].every((g) => g.every((s) => s.cards.length > 0))
  );

  const allCards = cardsOf(adminGuide);
  check("هر مورد شناسه و عنوان و خلاصه دارد", allCards.every((c) => !!c.id && !!c.title && !!c.summary));
  check(
    "شناسه‌ها تکراری نیستند",
    new Set(allCards.map((c) => c.id)).size === allCards.length
  );
  check(
    "هر مورد یا مرحله دارد یا نکته",
    allCards.every((c) => (c.steps?.length ?? 0) > 0 || (c.tips?.length ?? 0) > 0)
  );
  check("هیچ مرحله‌ای خالی نیست", allCards.every((c) => (c.steps ?? []).every((s) => s.lines.length > 0)));

  // لینک‌های داخل راهنما باید به صفحه‌های واقعی اشاره کنند
  const guideLinks = [...new Set(allCards.map((c) => c.href).filter((h): h is string => !!h))];
  const knownPages = new Set(
    readdirSync("src/app/admin/(dashboard)", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `/admin/${e.name}`)
      .concat(["/admin"]),
  );
  const brokenLinks = guideLinks.filter((h) => !knownPages.has(h));
  check(
    `همه‌ی لینک‌های راهنما به صفحه‌ی واقعی می‌روند${brokenLinks.length ? ` (${brokenLinks.join(", ")})` : ""}`,
    brokenLinks.length === 0
  );


  // ── مشتری‌های بدقول ─────────────────────────────────────────
  const NS_PHONE = "09129990101";
  await prisma.appointment.deleteMany({ where: { customer: { phone: NS_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: NS_PHONE } });

  const nsCustomer = await prisma.customer.create({
    data: { firstName: "بدقول", lastName: "آزمایشی", phone: NS_PHONE },
  });

  const nsAppt = async (daysAgo: number, status: "DONE" | "NO_SHOW") => {
    const at = new Date(Date.now() - daysAgo * 86_400_000);
    return prisma.appointment.create({
      data: {
        code: `SMOKE-NS${daysAgo}`,
        customerId: nsCustomer.id,
        serviceId: service.id,
        startsAt: at,
        endsAt: new Date(at.getTime() + 3_600_000),
        status,
        source: "smoke",
      },
    });
  };

  check("مشتری بدون سابقه علامتی نمی‌گیرد", (await noShowProfile(nsCustomer.id)).risk === "none");

  await nsAppt(30, "NO_SHOW");
  const one = await noShowProfile(nsCustomer.id);
  check("یک بار نیامدن هشدار نمی‌سازد", one.risk === "none" && one.streak === 1);

  await nsAppt(20, "NO_SHOW");
  const two = await noShowProfile(nsCustomer.id);
  check("دو بار پیاپی هشدار می‌گیرد", two.risk === "watch" && two.streak === 2);
  check("هنوز بیعانه اجباری نیست", !two.requiresDeposit);

  await nsAppt(10, "NO_SHOW");
  const three = await noShowProfile(nsCustomer.id);
  check("سه بار پیاپی بیعانه را اجباری می‌کند", three.requiresDeposit && three.risk === "high");
  check("پیام برای منشی نوشته می‌شود", !!three.message && three.message.includes("بیعانه"));

  // یک مراجعه‌ی واقعی، شمارشِ «پیاپی» را صفر می‌کند
  await nsAppt(5, "DONE");
  const afterVisit = await noShowProfile(nsCustomer.id);
  check("مراجعه‌ی واقعی، شمارش پیاپی را صفر می‌کند", afterVisit.streak === 0);
  check("ولی مجموع نیامدن‌ها یادش می‌ماند", afterVisit.total === 3);
  check("بعد از مراجعه، بیعانه دیگر اجباری نیست", !afterVisit.requiresDeposit);

  // گزارش مدیر
  const nsReport = await noShowReport(12);
  const nsRow = nsReport.find((r) => r.customerId === nsCustomer.id);
  check("در گزارش بدقول‌ها می‌آید", !!nsRow && nsRow.total === 3);
  check(
    "ارزش وقت‌های هدررفته تخمین زده می‌شود",
    !!nsRow && nsRow.wastedValue === 3 * (service.priceFrom ?? 0)
  );

  const nsCostFrom = new Date(Date.now() - 60 * 86_400_000);
  const nsCostRow = await noShowCost(nsCostFrom, new Date());
  check("هزینه‌ی نیامدن‌ها در بازه جمع می‌شود", nsCostRow.count >= 3);

  await prisma.appointment.deleteMany({ where: { customerId: nsCustomer.id } });
  await prisma.customer.delete({ where: { id: nsCustomer.id } });


  // ── اعلان تعطیلی ────────────────────────────────────────────
  await prisma.timeOff.deleteMany({ where: { reason: { startsWith: "SMOKE-OFF" } } });

  const closedFrom = new Date(Date.now() + 2 * 86_400_000);
  const closedTo = new Date(Date.now() + 5 * 86_400_000);
  await prisma.timeOff.create({
    data: { staffId: null, from: closedFrom, to: closedTo, reason: "SMOKE-OFF تعطیلات نوروز" },
  });

  const closures = await upcomingClosures();
  const smokeClosure = closures.find((c) => c.reason === "SMOKE-OFF تعطیلات نوروز");
  check("تعطیلی پیش‌رو به مشتری اعلام می‌شود", !!smokeClosure);
  check("متن تعطیلی تاریخ و علت دارد", !!smokeClosure?.message.includes("SMOKE-OFF"));
  check("الان تعطیل نیستیم", activeClosure(closures) === null);
  check(
    "وسط بازه، تعطیل حساب می‌شویم",
    activeClosure(closures, new Date(Date.now() + 3 * 86_400_000))?.reason === "SMOKE-OFF تعطیلات نوروز"
  );

  // مرخصی یک پرسنل نباید به‌عنوان تعطیلی کلینیک اعلام شود
  const offStaff = await prisma.staff.findFirstOrThrow();
  await prisma.timeOff.create({
    data: { staffId: offStaff.id, from: closedFrom, to: closedTo, reason: "SMOKE-OFF مرخصی شخصی" },
  });
  const afterStaffOff = await upcomingClosures();
  check(
    "مرخصی شخصی پرسنل به‌عنوان تعطیلی کلینیک اعلام نمی‌شود",
    !afterStaffOff.some((c) => c.reason === "SMOKE-OFF مرخصی شخصی")
  );

  // متن روزهای تعطیل باید از ساعات کاری واقعی بیاید، نه ثابت
  const closedText = await closedWeekdaysText();
  check("متن روزهای تعطیل ساخته می‌شود", closedText === null || closedText.length > 0);
  const openDays = await prisma.workingHour.findMany({ where: { isOpen: false } });
  if (openDays.length === 1) {
    check(
      "متن روز تعطیل با ساعات کاری واقعی می‌خواند",
      !!closedText && closedText.includes(WEEKDAYS_FA[openDays[0].weekday])
    );
  }

  await prisma.timeOff.deleteMany({ where: { reason: { startsWith: "SMOKE-OFF" } } });


  // ── نرخ اشغال و آمار سایت ───────────────────────────────────
  const utilRange = resolveRange("this-month");
  const util = await buildUtilization(utilRange);
  check("گزارش نرخ اشغال ساخته می‌شود", util.hasSchedules);
  check("ظرفیت از برنامه‌ی هفتگی حساب می‌شود", util.capacity > 0);
  check("نرخ اشغال بین صفر تا صد است", util.percent >= 0 && util.percent <= 100);
  check(
    "درصد هر روز با ظرفیت و پرشده‌اش می‌خواند",
    util.byWeekday.every(
      (d) => d.capacity === 0 || d.percent === Math.min(100, Math.round((d.booked / d.capacity) * 100))
    )
  );
  check("پرشده هیچ‌وقت از ظرفیت بیشتر گزارش نمی‌شود", util.byWeekday.every((d) => d.percent <= 100));
  check("ساعت‌های بدون ظرفیت در فهرست نمی‌آیند", util.byHour.every((h) => h.capacity > 0));
  check(
    "پرسنل از کم‌کارترین مرتب می‌شوند",
    util.byStaff.every((row, i) => i === 0 || util.byStaff[i - 1].percent <= row.percent)
  );

  // مرخصیِ کل کلینیک باید ظرفیت را کم کند
  const utilBefore = util.capacity;
  const offFrom = new Date(Math.max(utilRange.from.getTime(), Date.now() - 3 * 86_400_000));
  const offTo = new Date(offFrom.getTime() + 2 * 86_400_000);
  const bigOff = await prisma.timeOff.create({
    data: { staffId: null, from: offFrom, to: offTo, reason: "SMOKE-UTIL" },
  });
  const utilAfter = await buildUtilization(utilRange);
  check(
    `تعطیلی کلینیک ظرفیت را کم می‌کند (${utilBefore} ← ${utilAfter.capacity})`,
    utilAfter.capacity < utilBefore
  );
  await prisma.timeOff.delete({ where: { id: bigOff.id } });

  // آمار سایت
  await prisma.siteEvent.deleteMany({});
  const emptyStats = await buildSiteStats(utilRange);
  check("بدون داده، آمار سایت خالی گزارش می‌شود", !emptyStats.hasData);

  await trackEvent(EVENTS.serviceView, service.slug);
  await trackEvent(EVENTS.serviceView, service.slug);
  await trackEvent(EVENTS.serviceView, "botox");
  await trackEvent("چیز-نامعتبر", service.slug);
  for (let i = 0; i < 10; i++) await trackEvent(EVENTS.bookingStart);
  for (let i = 0; i < 8; i++) await trackEvent(EVENTS.bookingService, service.slug);
  for (let i = 0; i < 3; i++) await trackEvent(EVENTS.bookingTime, service.slug);
  for (let i = 0; i < 2; i++) await trackEvent(EVENTS.bookingDone, service.slug);

  const stats = await buildSiteStats(utilRange);
  check("رویداد نامعتبر ثبت نمی‌شود", stats.totalViews === 3);
  const laserRow = stats.byService.find((r) => r.slug === service.slug);
  check("بازدید هر خدمت جدا شمرده می‌شود", laserRow?.views === 2);
  check("عنوان فارسی خدمت در آمار می‌آید", laserRow?.title === service.title);
  check("پربازدیدترین اول می‌آید", stats.byService[0]?.slug === service.slug);
  check("قیف رزرو مراحل را می‌شمارد", stats.funnel.started === 10 && stats.funnel.finished === 2);
  check(
    "بیشترین ریزش درست تشخیص داده می‌شود",
    stats.funnel.biggestDropLabel === "از انتخاب خدمت تا انتخاب ساعت"
  );
  check("درصد ریزش درست است", stats.funnel.biggestDropPercent === 63);

  const pruned = await pruneEvents(0);
  check("پاک‌سازی رویدادهای قدیمی کار می‌کند", pruned > 0);
  await prisma.siteEvent.deleteMany({});

  // ── بستن صندوق ──────────────────────────────────────────────
  const CASH_PHONE = "09129990055";
  await prisma.payment.deleteMany({ where: { customer: { phone: CASH_PHONE } } });
  await prisma.customer.deleteMany({ where: { phone: CASH_PHONE } });
  await prisma.expense.deleteMany({ where: { title: { startsWith: "SMOKE-CASH" } } });

  // یک روز مشخص در گذشته، تا با داده‌ی واقعیِ دیگر قاطی نشود
  const cashDate = new Date();
  cashDate.setDate(cashDate.getDate() - 3);
  const cashKey = `${cashDate.getFullYear()}-${String(cashDate.getMonth() + 1).padStart(2, "0")}-${String(cashDate.getDate()).padStart(2, "0")}`;
  const cashNoon = atTime(parseYmdKey(cashKey), "12:00");
  await prisma.cashClose.deleteMany({ where: { day: atTime(parseYmdKey(cashKey), "00:00") } });

  const cashCustomer = await prisma.customer.create({
    data: { firstName: "صندوق", lastName: "آزمایشی", phone: CASH_PHONE },
  });

  // ۵۰۰ هزار نقد + ۳۰۰ هزار کارت + ۲۰۰ هزار آنلاین
  await prisma.payment.createMany({
    data: [
      { customerId: cashCustomer.id, amount: 300_000, method: "CASH", status: "PAID", paidAt: cashNoon },
      { customerId: cashCustomer.id, amount: 200_000, method: "CASH", status: "PAID", paidAt: cashNoon },
      { customerId: cashCustomer.id, amount: 300_000, method: "CARD", status: "PAID", paidAt: cashNoon },
      { customerId: cashCustomer.id, amount: 200_000, method: "ONLINE", status: "PAID", paidAt: cashNoon },
      // پرداخت نافرجام نباید شمرده شود
      { customerId: cashCustomer.id, amount: 900_000, method: "ONLINE", status: "FAILED", paidAt: cashNoon },
    ],
  });

  const cashCategory = await prisma.expenseCategory.findFirstOrThrow();
  await prisma.expense.create({
    data: {
      categoryId: cashCategory.id,
      title: "SMOKE-CASH خرید از صندوق",
      amount: 120_000,
      spentAt: cashNoon,
      paidFromCash: true,
    },
  });
  await prisma.expense.create({
    data: {
      categoryId: cashCategory.id,
      title: "SMOKE-CASH پرداخت با کارت",
      amount: 500_000,
      spentAt: cashNoon,
      paidFromCash: false,
    },
  });

  const cashDay = await buildCashDay(cashKey);
  check(
    `نقدی روز درست جمع می‌شود (${cashDay.expectedCash})`,
    cashDay.expectedCash === 500_000
  );
  check(
    "پرداخت ناموفق در صندوق شمرده نمی‌شود",
    (cashDay.lines.find((l) => l.method === "ONLINE")?.amount ?? 0) === 200_000
  );
  check(`جمع کل دریافتی درست است (${cashDay.total})`, cashDay.total === 1_000_000);
  check(
    "فقط هزینه‌ی «از صندوق» کم می‌شود",
    cashDay.cashExpenses === 120_000 && cashDay.cashExpenseRows.length === 1
  );
  check(
    `انتظارِ کشو = نقدی منهای هزینه‌ی صندوق (${cashDay.expectedInDrawer})`,
    cashDay.expectedInDrawer === 380_000
  );
  check("روز هنوز بسته نشده", cashDay.closed === null);

  // این روز باید در فهرست «بسته‌نشده» بیاید
  const openBefore = await unclosedDays(14);
  check("روزِ نبسته در فهرست هشدار می‌آید", openBefore.includes(cashKey));

  // کسری
  const short = await closeCashDay({ dateKey: cashKey, countedCash: 350_000 });
  check(
    `کسری درست حساب می‌شود (${short.ok ? short.difference : "خطا"})`,
    short.ok && short.difference === -30_000
  );

  const closedDay = await buildCashDay(cashKey);
  check("پس از بستن، شمارش در همان روز دیده می‌شود", closedDay.closed?.countedCash === 350_000);
  check("روزِ بسته دیگر در فهرست هشدار نیست", !(await unclosedDays(14)).includes(cashKey));

  // اصلاح شمارش — همان روز دوباره بسته می‌شود، نه ردیف تازه
  const exact = await closeCashDay({ dateKey: cashKey, countedCash: 380_000, note: "اشتباه شمرده بودم" });
  check("شمارش اصلاح‌شده اختلاف را صفر می‌کند", exact.ok && exact.difference === 0);
  const closeRows = await prisma.cashClose.count({
    where: { day: atTime(parseYmdKey(cashKey), "00:00") },
  });
  check("برای هر روز فقط یک ردیف می‌ماند", closeRows === 1);

  // مبلغ منفی و روز آینده رد می‌شوند
  const negative = await closeCashDay({ dateKey: cashKey, countedCash: -5 });
  check("مبلغ منفی رد می‌شود", !negative.ok);

  const future = new Date();
  future.setDate(future.getDate() + 3);
  const futureKey = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
  const futureClose = await closeCashDay({ dateKey: futureKey, countedCash: 1000 });
  check("روز نیامده بسته نمی‌شود", !futureClose.ok);

  // تاریخچه
  const closeHistory = await recentCloses(20);
  const historyRow = closeHistory.find((r) => r.dateKey === cashKey);
  check(
    "تاریخچه‌ی صندوق روز را با کارت‌خوان و آنلاینش نگه می‌دارد",
    historyRow?.cardTotal === 300_000 && historyRow?.onlineTotal === 200_000
  );
  check("یادداشت اصلاح ذخیره شده", historyRow?.note === "اشتباه شمرده بودم");

  await prisma.cashClose.deleteMany({ where: { day: atTime(parseYmdKey(cashKey), "00:00") } });
  await prisma.expense.deleteMany({ where: { title: { startsWith: "SMOKE-CASH" } } });
  await prisma.payment.deleteMany({ where: { customerId: cashCustomer.id } });
  await prisma.customer.delete({ where: { id: cashCustomer.id } });

  // ── گزارش فعالیت ────────────────────────────────────────────
  await prisma.auditLog.deleteMany({ where: { detail: { startsWith: "SMOKE-AUDIT" } } });
  const auditUser = await prisma.user.findFirstOrThrow();

  await prisma.auditLog.createMany({
    data: [
      { userId: auditUser.id, action: "appointment.delete", entity: "Appointment", detail: "SMOKE-AUDIT حذف نوبت" },
      { userId: auditUser.id, action: "settings.save", entity: "Setting", detail: "SMOKE-AUDIT تنظیمات" },
      { action: "login.failed", entity: "User", detail: "SMOKE-AUDIT-attacker@example.com" },
    ],
  });

  const auditAll = await listAudit({ days: 1, perPage: 200 });
  const auditMine = auditAll.rows.filter((r) => r.detail?.startsWith("SMOKE-AUDIT"));
  check("گزارش فعالیت رویدادها را برمی‌گرداند", auditMine.length === 3);

  const deleteRow = auditMine.find((r) => r.action === "appointment.delete");
  check("عمل به فارسی توضیح داده می‌شود", deleteRow?.description === "حذف نوبت");
  check("حذف با رنگ قرمز علامت می‌خورد", deleteRow?.tone === "red");
  check("نام انجام‌دهنده می‌آید", deleteRow?.who === auditUser.name);

  const failedRow = auditMine.find((r) => r.action === "login.failed");
  check("تلاش ناموفق ورود کاربر ندارد", failedRow?.who === "—");
  check("تلاش ناموفق قرمز است", failedRow?.tone === "red");

  // فیلتر دسته‌بندی
  const securityOnly = await listAudit({ days: 1, group: "security", perPage: 200 });
  const secDetails = securityOnly.rows.filter((r) => r.detail?.startsWith("SMOKE-AUDIT"));
  check(
    "فیلتر «امنیت» فقط رویدادهای امنیتی را می‌آورد",
    secDetails.length === 1 && secDetails[0].action === "login.failed"
  );

  const settingsOnly = await listAudit({ days: 1, group: "settings", perPage: 200 });
  check(
    "فیلتر «تنظیمات» درست کار می‌کند",
    settingsOnly.rows.filter((r) => r.detail?.startsWith("SMOKE-AUDIT")).length === 1
  );

  // فیلتر کاربر و جستجو
  const byUser = await listAudit({ days: 1, userId: auditUser.id, perPage: 200 });
  check(
    "فیلتر کاربر، رویدادِ بی‌کاربر را نمی‌آورد",
    !byUser.rows.some((r) => r.detail === "SMOKE-AUDIT-attacker@example.com")
  );

  const searched = await listAudit({ days: 1, q: "SMOKE-AUDIT-attacker", perPage: 200 });
  check("جستجو در جزئیات کار می‌کند", searched.rows.length === 1);

  // صفحه‌بندی
  const paged = await listAudit({ days: 1, perPage: 10, page: 1 });
  check(
    "صفحه‌بندی درست شمرده می‌شود",
    paged.rows.length <= 10 && paged.pages === Math.max(1, Math.ceil(paged.total / 10))
  );

  await prisma.auditLog.deleteMany({ where: { detail: { startsWith: "SMOKE-AUDIT" } } });

  // ── جستجوی سراسری ───────────────────────────────────────────
  const SR_PHONE = "09125558822";
  await prisma.customer.deleteMany({ where: { phone: SR_PHONE } });
  const srCustomer = await prisma.customer.create({
    data: { firstName: "نازنین", lastName: "جستجویی", phone: SR_PHONE },
  });

  check("جستجو با نام", (await searchEverything("نازنین")).some((h) => h.id === srCustomer.id));
  check(
    "جستجو با شماره‌ی موبایل",
    (await searchEverything("09125558822")).some((h) => h.id === srCustomer.id)
  );
  check(
    "جستجو با ارقام فارسی",
    (await searchEverything("۰۹۱۲۵۵۵۸۸۲۲")).some((h) => h.id === srCustomer.id)
  );
  check("جستجوی یک‌حرفی نتیجه نمی‌دهد", (await searchEverything("ن")).length === 0);

  await prisma.customer.delete({ where: { id: srCustomer.id } });

  // ── راهنمای راه‌اندازی و فهرست کارها ────────────────────────
  const setup = await getSetupStatus();
  check(
    `راهنمای راه‌اندازی ${toFa(setup.total)} گام دارد`,
    setup.total >= 8 && setup.done <= setup.total
  );
  check(
    "گام‌های ضروری علامت‌گذاری شده‌اند",
    setup.steps.some((step) => step.critical) && setup.steps.every((step) => !!step.href)
  );

  const adminItems = await getAttentionItems("ADMIN");
  const operatorItems = await getAttentionItems("OPERATOR");
  check(
    "فهرست کارها بر اساس نقش فیلتر می‌شود",
    operatorItems.length <= adminItems.length
  );
  check(
    "هر مورد فهرست کارها عدد و لینک دارد",
    adminItems.every((item) => item.count > 0 && item.href.startsWith("/admin"))
  );

  // ── پاک‌سازی داده‌ی برنامه‌ی قدیمی ──────────────────────────
  // این قانون‌ها روی داده‌ی واقعیِ مادرِ کلینیک اجرا می‌شوند؛ اگر خراب شوند
  // تاریخچه‌ی ۲۷۰۰ مشتری و ۲۳۸ میلیون تومان درآمد اشتباه منتقل می‌شود.

  const jalaliRaw = cleanDate(new Date(1400, 7, 17, 12, 30));
  check(
    "تاریخ شمسیِ خام درست تبدیل می‌شود",
    jalaliRaw.value?.toISOString().slice(0, 10) === "2021-11-08"
  );
  check("ساعتِ تاریخ شمسی حفظ می‌شود", jalaliRaw.value?.getHours() === 12);

  const doubled = cleanDate(new Date(2643, 6, 3));
  check(
    "سالِ دوبار تبدیل‌شده ۶۲۱ سال برمی‌گردد",
    doubled.value?.getFullYear() === 2022 && doubled.value?.getMonth() === 6
  );

  const shortYear = cleanDate(new Date(1022, 2, 3));
  check("سالِ ناقص («۴۰۱») بازیابی می‌شود", shortYear.value?.getFullYear() === 2022);

  check("سالِ بی‌معنی رد می‌شود", cleanDate(new Date(634, 2, 3)).value === null);
  check("تاریخ درست دست‌نخورده می‌ماند", cleanDate(new Date(2022, 2, 17)).note === null);

  check("ستاره از وسط شماره پاک می‌شود", cleanPhone("0*9375185565").value === "09375185565");
  check("فاصله‌ی ابتدای شماره پاک می‌شود", cleanPhone(" 09363652565").kind === "mobile");
  check("موبایلِ ناقص «معتبر» شمرده نمی‌شود", cleanPhone("0935873609").kind === "invalid");
  check("شماره‌ی ثابت جدا تشخیص داده می‌شود", cleanPhone("34800545").kind === "landline");
  check("شماره‌ی «۰» یعنی شماره‌ای نبوده", cleanPhone("0").value === "");
  check("شماره‌ی درست دست‌نخورده می‌ماند", cleanPhone("09121110005").note === null);

  check("مبلغ زیر هزار، هزارتومان است", cleanAmount(450).value === 450_000);
  check("اصلاح مبلغ یادداشت می‌گذارد", (cleanAmount(450).note ?? "").includes("450"));
  check("مبلغ درست دست‌نخورده می‌ماند", cleanAmount(450_000).note === null);
  check("مبلغ صفر صفر می‌ماند", cleanAmount(0).value === 0);

  // ─── تمیزکردن متنِ کپی‌شده از هوش مصنوعی ─────────────────────
  // اگر این‌ها درست کار نکنند، ستاره و مربع خام روی صفحه‌ی مقاله
  // ظاهر می‌شود و کسی که متن را گذاشته نمی‌فهمد چرا.
  check("عنوان تک‌# به ## تبدیل می‌شود", tidyRichText("# سلام") === "## سلام");
  check("عنوان چهار‌# به ### می‌شود", tidyRichText("#### سلام") === "### سلام");
  check("فهرست با ستاره به خط‌تیره می‌شود", tidyRichText("* یک\n* دو") === "- یک\n- دو");
  check("فهرست با بولت فارسی هم تبدیل می‌شود", tidyRichText("• یک") === "- یک");
  check("تورفتگی فهرست صاف می‌شود", tidyRichText("   - یک") === "- یک");
  check("__پررنگ__ به **پررنگ** می‌شود", tidyRichText("__مهم__") === "**مهم**");
  check("*مورب* به **پررنگ** می‌شود", tidyRichText("متن *مهم* است") === "متن **مهم** است");
  check(
    "**پررنگِ درست** دوباره دستکاری نمی‌شود",
    tidyRichText("متن **مهم** است") === "متن **مهم** است",
  );
  check("خط جداکننده حذف می‌شود", tidyRichText("یک\n\n---\n\nدو") === "یک\n\nدو");
  check("~~خط‌خورده~~ ساده می‌شود", tidyRichText("~~قدیمی~~") === "قدیمی");
  check("بلوک کد باز می‌شود", tidyRichText("```\nمتن\n```") === "متن");
  check("تصویر داخل متن حذف می‌شود", tidyRichText("![عکس](/a.png)سلام") === "سلام");
  check(
    "جدول به فهرست تبدیل می‌شود و محتوایش گم نمی‌شود",
    tidyRichText("| نام | مدت |\n| --- | --- |\n| لیزر | ۳۰ دقیقه |") ===
      "- نام — مدت\n- لیزر — ۳۰ دقیقه",
  );
  check("خط خالی اضافی جمع می‌شود", tidyRichText("یک\n\n\n\nدو") === "یک\n\nدو");
  check(
    "متنی که از قبل درست است دست‌نخورده می‌ماند",
    tidyRichText("## عنوان\n\nیک بند.\n\n- یک\n- دو") === "## عنوان\n\nیک بند.\n\n- یک\n- دو",
  );
  check("متن خالی خالی می‌ماند", tidyRichText("   ") === "");

  // ─── کدهای خطای ملی پیامک ───────────────────────────────────
  // هدف این تست‌ها «درستی ترجمه» نیست، «قابل‌اقدام‌بودن» است: هر پیام
  // باید بگوید چه کار کنیم.
  check("کد ۱۴ می‌گوید مشکل لینک است", meliErrorMessage("14").includes("لینک"));
  check("کد -۱۰۹ به IP مجاز اشاره می‌کند", meliErrorMessage("-109").includes("IP"));
  check("کد -۱۱۰ می‌گوید APIKey بگذار", meliErrorMessage("-110").includes("APIKey"));
  check("کد ۰ به نام کاربری و رمز اشاره می‌کند", meliErrorMessage("0").includes("رمز"));
  check("کد ۲ می‌گوید شارژ کن", meliErrorMessage("2").includes("شارژ"));
  check("کد ۵ به شماره‌ی فرستنده اشاره می‌کند", meliErrorMessage("5").includes("فرستنده"));
  check(
    "کد ناشناس متن خودِ سرویس را پس می‌دهد",
    meliErrorMessage("999", "یک خطای تازه") === "یک خطای تازه",
  );
  check("کد ناشناس بدون متن، خودِ کد را می‌گوید", meliErrorMessage("999").includes("999"));

  check(
    "«آزادمنجیری» و «آزاد منجیری» یک نفرند",
    normalizeName("سحر آزادمنجیری") === normalizeName("سحر آزاد منجیری")
  );
  check(
    "ی و ک عربی با فارسی یکی شمرده می‌شوند",
    normalizeName("تيبه كمالي") === normalizeName("تیبه کمالی")
  );
  check(
    "دو نفر با نام واقعاً متفاوت یکی نمی‌شوند",
    normalizeName("فاطمه تقوی") !== normalizeName("آتوسا تقوی")
  );

  // ── نگهداری نسخه‌های پشتیبان ────────────────────────────────
  // سناریوی واقعیِ کرون: هر شب سبک، هفته‌ای یک بار کامل. اگر هرس‌کردن نوع را
  // نشناسد، بعد از دو هفته هیچ نسخه‌ای با عکسِ پرونده‌ها باقی نمی‌ماند.
  const backupDir = BACKUP_DIR;
  mkdirSync(backupDir, { recursive: true });
  // بدترین حالتِ واقعی: نسخه‌ی کامل ماهی یک بار (چون حجیم است) و سبک هر شب.
  // آن‌وقت تعداد نسخه‌های سبکِ جدیدتر از حدِ نگهداری بیشتر می‌شود و اگر هرس
  // نوع را نشناسد، تنها نسخه‌ی دارای عکس را پاک می‌کند.
  const madeUp: string[] = [];
  const stamp = (day: number, kind: string) =>
    `sharzad-backup-1400-01-${String(day + 1).padStart(2, "0")}-0${kind === "full" ? 1 : 2}00-${kind}.zip`;
  const put = (day: number, kind: "full" | "light") => {
    const name = stamp(day, kind);
    writeFileSync(join(backupDir, name), "x");
    // mtime دستی، چون همه در یک لحظه ساخته می‌شوند
    const when = new Date(Date.now() - (40 - day) * 86_400_000);
    utimesSync(join(backupDir, name), when, when);
    madeUp.push(name);
  };

  put(0, "full");
  for (let day = 1; day <= 20; day++) put(day, "light");

  const beforePrune = await listBackups();
  check(
    "نوع نسخه از روی نام تشخیص داده می‌شود",
    beforePrune.filter((b) => b.kind === "full").length >= 1 &&
      beforePrune.filter((b) => b.kind === "light").length >= 20
  );

  await pruneBackups(14);
  const afterPrune = await listBackups();
  // دقیقاً همان نسخه‌ی کاملی که ساختیم باید بماند؛ «یک نسخه‌ی کامل هست»
  // کافی نیست چون ممکن است نسخه‌ی واقعیِ دیگری در پوشه باشد
  check(
    "بعد از هرس، نسخه‌ی دارای عکس پاک نمی‌شود",
    afterPrune.some((b) => b.filename === stamp(0, "full"))
  );
  check(
    "از هر نوع حداکثر ۱۴ تا می‌ماند",
    afterPrune.filter((b) => b.kind === "light").length <= 14 &&
      afterPrune.filter((b) => b.kind === "full").length <= 14
  );

  for (const name of madeUp) rmSync(join(backupDir, name), { force: true });

  await prisma.appointment.deleteMany({ where: { source: "smoke" } });
  await prisma.appointment.deleteMany({ where: { customer: { phone: "09129998877" } } });
  await prisma.customer.deleteMany({ where: { phone: "09129998877" } });
  await prisma.$disconnect();

  console.log(failures === 0 ? "\n🎉 همه‌ی تست‌ها پاس شد." : `\n❌ ${failures} تست شکست خورد.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
