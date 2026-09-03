import "server-only";
import { prisma } from "../prisma";
import { getSmsDriver, smsRecipient } from "./sms";
import { emailTemplate, sendEmail } from "./email";
import { formatJalaliDateTime } from "../date";
import { toFa } from "../utils";
import { DEFAULT_SETTINGS, getSettings } from "../settings";

export type NotifyResult = { ok: boolean; simulated?: boolean; error?: string };

/** ارسال پیامک + ثبت در لاگ. هرگز خطا پرتاب نمی‌کند تا جریان اصلی نیفتد. */
async function sendSms(options: {
  to: string;
  template: string;
  message: string;
  otpCode?: string;
}): Promise<NotifyResult> {
  const driver = getSmsDriver();
  const recipient = smsRecipient(options.to);

  let result;
  try {
    result = options.otpCode
      ? await driver.sendOtp(recipient, options.otpCode)
      : await driver.send(recipient, options.message);
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "خطای ناشناخته" };
  }

  await prisma.notificationLog
    .create({
      data: {
        channel: "SMS",
        recipient,
        template: options.template,
        // کد یکبارمصرف هرگز در لاگ ذخیره نمی‌شود
        body: options.otpCode ? "[کد یکبارمصرف]" : options.message,
        status: result.ok ? (result.simulated ? "skipped" : "sent") : "failed",
        error: result.error ?? null,
        providerId: result.providerId ?? null,
      },
    })
    .catch(() => undefined);

  return { ok: result.ok, simulated: result.simulated, error: result.error };
}

async function sendMail(options: {
  to: string;
  template: string;
  subject: string;
  title: string;
  body: string;
}): Promise<NotifyResult> {
  const settings = await getSettings();
  const html = emailTemplate({
    clinicName: settings.clinicName ?? DEFAULT_SETTINGS.clinicName,
    title: options.title,
    body: options.body,
  });

  const result = await sendEmail({ to: options.to, subject: options.subject, html });

  await prisma.notificationLog
    .create({
      data: {
        channel: "EMAIL",
        recipient: options.to,
        template: options.template,
        body: options.subject,
        status: result.ok ? (result.simulated ? "skipped" : "sent") : "failed",
        error: result.error ?? null,
        providerId: result.providerId ?? null,
      },
    })
    .catch(() => undefined);

  return { ok: result.ok, simulated: result.simulated, error: result.error };
}

// ─── پیام‌های آماده ────────────────────────────────────────────

/** کد ورود مشتری */
export async function notifyOtp(phone: string, code: string): Promise<NotifyResult> {
  return sendSms({
    to: phone,
    template: "otp",
    message: `کد ورود شما: ${code}`,
    otpCode: code,
  });
}

/** پیامک هنگام ثبت نوبت */
export async function notifyBookingCreated(options: {
  phone: string;
  customerName: string;
  serviceTitle: string;
  startsAt: Date;
  code: string;
}): Promise<NotifyResult> {
  const settings = await getSettings();
  const message =
    `${options.customerName} عزیز، نوبت شما ثبت شد.\n` +
    `${options.serviceTitle}\n` +
    `${formatJalaliDateTime(options.startsAt)}\n` +
    `کد پیگیری: ${options.code}\n` +
    `${settings.clinicName}`;

  return sendSms({ to: options.phone, template: "booking_created", message });
}

/** پیامک هنگام تأیید نوبت توسط پذیرش */
export async function notifyBookingConfirmed(options: {
  phone: string;
  customerName: string;
  serviceTitle: string;
  startsAt: Date;
}): Promise<NotifyResult> {
  const settings = await getSettings();
  const message =
    `${options.customerName} عزیز، نوبت شما تأیید شد.\n` +
    `${options.serviceTitle}\n` +
    `${formatJalaliDateTime(options.startsAt)}\n` +
    `${settings.clinicName}`;

  return sendSms({ to: options.phone, template: "booking_confirmed", message });
}

/** پیامک لغو نوبت */
export async function notifyBookingCancelled(options: {
  phone: string;
  customerName: string;
  startsAt: Date;
}): Promise<NotifyResult> {
  const settings = await getSettings();
  const message =
    `${options.customerName} عزیز، نوبت شما در ${formatJalaliDateTime(options.startsAt)} لغو شد.\n` +
    `برای رزرو مجدد با ما تماس بگیرید: ${settings.phone}\n${settings.clinicName}`;

  return sendSms({ to: options.phone, template: "booking_cancelled", message });
}

/** یادآوری یک روز قبل از نوبت */
export async function notifyBookingReminder(options: {
  phone: string;
  customerName: string;
  serviceTitle: string;
  startsAt: Date;
}): Promise<NotifyResult> {
  const settings = await getSettings();
  const message =
    `${options.customerName} عزیز، یادآوری نوبت فردا:\n` +
    `${options.serviceTitle}\n` +
    `ساعت ${toFa(String(options.startsAt.getHours()).padStart(2, "0"))}:` +
    `${toFa(String(options.startsAt.getMinutes()).padStart(2, "0"))}\n` +
    `${settings.address}\n${settings.clinicName}`;

  return sendSms({ to: options.phone, template: "booking_reminder", message });
}

/** تبریک تولد مشتری */
export async function notifyBirthday(phone: string, message: string): Promise<NotifyResult> {
  return sendSms({ to: phone, template: "birthday", message });
}

/** گزارش شبانه‌ی خلاصه‌ی روز برای مدیر */
export async function notifyDailyDigest(phone: string, message: string): Promise<NotifyResult> {
  return sendSms({ to: phone, template: "daily_digest", message });
}

/** دعوت به نظرسنجی پس از مراجعه */
export async function notifyFeedbackRequest(options: {
  phone: string;
  customerName: string;
  serviceTitle: string;
  url: string;
}): Promise<NotifyResult> {
  const settings = await getSettings();
  const message =
    `${options.customerName} عزیز، از مراجعه‌تان ممنونیم.\n` +
    `نظرتان درباره‌ی ${options.serviceTitle} برای ما مهم است؛ یک دقیقه وقت می‌گیرد:\n` +
    `${options.url}\n${settings.clinicName}`;

  return sendSms({ to: options.phone, template: "feedback_request", message });
}

/** خبر دادن به کسی که در لیست انتظار است و حالا وقت خالی شده */
export async function notifyWaitlistOpening(options: {
  phone: string;
  customerName: string;
  serviceTitle: string;
  startsAt?: Date | null;
}): Promise<NotifyResult> {
  const settings = await getSettings();
  const when = options.startsAt
    ? `وقت خالی: ${formatJalaliDateTime(options.startsAt)}\n`
    : "";
  const message =
    `${options.customerName} عزیز، برای ${options.serviceTitle} وقت خالی شد.\n` +
    when +
    `برای رزرو تماس بگیرید: ${settings.phone}\n${settings.clinicName}`;

  return sendSms({ to: options.phone, template: "waitlist_opening", message });
}

/** اطلاع‌رسانی پیام تماس جدید به مدیر کلینیک */
export async function notifyContactMessage(options: {
  name: string;
  phone: string;
  body: string;
}): Promise<NotifyResult> {
  const settings = await getSettings();
  if (!settings.email) return { ok: false, error: "ایمیل کلینیک تنظیم نشده است." };

  return sendMail({
    to: settings.email,
    template: "contact_received",
    subject: `پیام جدید از ${options.name}`,
    title: "پیام جدید از فرم تماس سایت",
    body:
      `<p><strong>نام:</strong> ${escapeHtml(options.name)}</p>` +
      `<p><strong>موبایل:</strong> ${escapeHtml(options.phone)}</p>` +
      `<p><strong>پیام:</strong><br>${escapeHtml(options.body).replace(/\n/g, "<br>")}</p>`,
  });
}

/** ایمیل تأیید نوبت برای مشتری‌هایی که ایمیل داده‌اند */
export async function notifyBookingEmail(options: {
  email: string;
  customerName: string;
  serviceTitle: string;
  startsAt: Date;
  code: string;
}): Promise<NotifyResult> {
  return sendMail({
    to: options.email,
    template: "booking_created_email",
    subject: "تأیید ثبت نوبت",
    title: `${options.customerName} عزیز، نوبت شما ثبت شد`,
    body:
      `<p><strong>خدمت:</strong> ${escapeHtml(options.serviceTitle)}</p>` +
      `<p><strong>زمان:</strong> ${formatJalaliDateTime(options.startsAt)}</p>` +
      `<p><strong>کد پیگیری:</strong> ${escapeHtml(options.code)}</p>` +
      `<p>همکاران ما به‌زودی برای تأیید نهایی با شما تماس می‌گیرند.</p>`,
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}

export { sendSms, sendMail };
