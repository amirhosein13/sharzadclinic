import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { formatJalaliLong } from "./date";

/**
 * جای‌گذاری متغیرها در متن رضایت‌نامه. قالب‌ها را منشی و مدیر می‌نویسند،
 * پس نگه‌داشتن نشانه‌ها به فارسی خواناترشان می‌کند.
 */
export const CONSENT_PLACEHOLDERS = [
  { key: "{{نام}}", label: "نام و نام خانوادگی مراجعه‌کننده" },
  { key: "{{کدملی}}", label: "کد ملی مراجعه‌کننده" },
  { key: "{{تاریخ}}", label: "تاریخ امضا (شمسی)" },
  { key: "{{کلینیک}}", label: "نام کلینیک" },
] as const;

export async function renderConsentBody(
  body: string,
  vars: { fullName: string; nationalCode?: string | null; signedAt?: Date },
): Promise<string> {
  const settings = await getSettings();
  const signedAt = vars.signedAt ?? new Date();
  return body
    .replaceAll("{{نام}}", vars.fullName)
    .replaceAll("{{کدملی}}", vars.nationalCode || "—")
    .replaceAll("{{تاریخ}}", formatJalaliLong(signedAt))
    .replaceAll("{{کلینیک}}", settings.clinicName);
}

/** رضایت‌نامه‌ای که برای خدمتِ مشخصی لازم است ولی هنوز امضا نشده */
export type MissingConsent = {
  templateId: string;
  templateTitle: string;
  /** خدماتی از همین مشتری که این رضایت‌نامه برایشان لازم است */
  serviceTitles: string[];
  /** آیا نوبتِ پیش‌رو دارد؟ یعنی عجله دارد */
  upcoming: boolean;
};

/**
 * «این مشتری چه رضایت‌نامه‌ای را امضا نکرده؟»
 *
 * فقط قالب‌هایی که به خدمتی وصل‌اند این‌جا حساب می‌شوند؛ قالب‌های عمومی
 * (بدون خدمت) هشدار نمی‌سازند، وگرنه برای همه‌ی مشتری‌ها قرمز می‌شد و
 * هشدار بی‌معنی می‌شود.
 */
export async function missingConsents(customerId: string): Promise<MissingConsent[]> {
  const now = new Date();

  const [appointments, templates, signed] = await Promise.all([
    prisma.appointment.findMany({
      where: { customerId, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      select: { serviceId: true, startsAt: true, service: { select: { title: true } } },
    }),
    prisma.consentTemplate.findMany({
      where: { isActive: true, services: { some: {} } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        services: { select: { serviceId: true } },
      },
    }),
    prisma.consentSignature.findMany({
      where: { customerId },
      select: { templateId: true },
    }),
  ]);

  if (appointments.length === 0) return [];

  const signedIds = new Set(signed.map((s) => s.templateId));

  // برای هر خدمت: عنوانش و اینکه نوبت پیش‌رو دارد یا نه
  const byService = new Map<string, { title: string; upcoming: boolean }>();
  for (const appt of appointments) {
    const prev = byService.get(appt.serviceId);
    const upcoming = appt.startsAt > now;
    byService.set(appt.serviceId, {
      title: appt.service.title,
      upcoming: (prev?.upcoming ?? false) || upcoming,
    });
  }

  const missing: MissingConsent[] = [];
  for (const template of templates) {
    if (signedIds.has(template.id)) continue;

    const related = template.services
      .map((s) => byService.get(s.serviceId))
      .filter((s): s is { title: string; upcoming: boolean } => !!s);
    if (related.length === 0) continue;

    missing.push({
      templateId: template.id,
      templateTitle: template.title,
      serviceTitles: [...new Set(related.map((s) => s.title))],
      upcoming: related.some((s) => s.upcoming),
    });
  }

  // آن‌هایی که نوبت پیش‌رو دارند اول بیایند — کار فوری‌ترند
  return missing.sort((a, b) => Number(b.upcoming) - Number(a.upcoming));
}
