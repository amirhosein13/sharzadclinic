import "server-only";
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
