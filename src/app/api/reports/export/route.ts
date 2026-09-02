import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildReport, isRangeKey, resolveRange } from "@/lib/reports";
import { toCsv } from "@/lib/csv";
import { formatJalali } from "@/lib/date";
import { toEn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user || !can(user.role, "payroll")) {
    return new NextResponse("دسترسی ندارید.", { status: 403 });
  }

  const key = new URL(request.url).searchParams.get("range") ?? "this-month";
  const range = resolveRange(isRangeKey(key) ? key : "this-month");
  const report = await buildReport(range);

  // اعداد را خام می‌نویسیم تا در اکسل قابل جمع‌زدن باشند
  const csv = toCsv([
    {
      title: `گزارش ${range.label}`,
      head: ["شاخص", "مقدار"],
      rows: [
        ["درآمد کل (تومان)", report.revenue],
        ["تعداد پرداخت", report.paymentCount],
        ["میانگین هر پرداخت (تومان)", report.averageTicket],
        ["کل نوبت‌ها", report.appointments.total],
        ["انجام‌شده", report.appointments.done],
        ["لغوشده", report.appointments.cancelled],
        ["عدم مراجعه", report.appointments.noShow],
        ["نرخ عدم مراجعه (درصد)", report.appointments.noShowRate],
        ["مشتری جدید", report.customers.newCount],
        ["مشتری فعال", report.customers.activeCount],
        ["مشتری بازگشتی", report.customers.returningCount],
        ["نرخ بازگشت (درصد)", report.customers.returningRate],
      ],
    },
    {
      title: "درآمد به تفکیک خدمت",
      head: ["خدمت", "جلسه", "درآمد (تومان)"],
      rows: report.byService.map((r) => [r.label, r.sessions, r.revenue]),
    },
    {
      title: "درآمد به تفکیک پرسنل",
      head: ["پرسنل", "جلسه", "درآمد (تومان)"],
      rows: report.byStaff.map((r) => [r.label, r.sessions, r.revenue]),
    },
    {
      title: "روش پرداخت",
      head: ["روش", "تعداد", "مبلغ (تومان)"],
      rows: report.byMethod.map((r) => [r.label, r.count, r.revenue]),
    },
    {
      title: "شلوغی روزهای هفته",
      head: ["روز", "نوبت"],
      rows: report.byWeekday.map((r) => [r.label, r.sessions]),
    },
    {
      title: "شلوغی ساعت‌ها",
      head: ["ساعت", "نوبت"],
      rows: report.byHour.map((r) => [`${String(r.hour).padStart(2, "0")}:00`, r.sessions]),
    },
    {
      title: "مشتریان برتر",
      head: ["نام", "موبایل", "مراجعه", "مبلغ (تومان)"],
      rows: report.topCustomers.map((c) => [c.name, c.phone, c.visits, c.spent]),
    },
    {
      title: "روند روزانه",
      head: ["تاریخ", "جلسه", "درآمد (تومان)"],
      rows: report.daily.map((d) => [d.label, d.sessions, d.revenue]),
    },
  ]);

  // هدر HTTP فقط بایت‌های لاتین را می‌پذیرد، پس ارقام فارسی را برمی‌گردانیم
  const filename = `sharzad-report-${toEn(formatJalali(new Date(), "yyyy-MM-dd"))}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
