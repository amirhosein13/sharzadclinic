import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type EmailResult = { ok: boolean; providerId?: string; error?: string; simulated?: boolean };

let transporter: Transporter | null = null;
let configured: boolean | null = null;

function getTransporter(): Transporter | null {
  if (configured === false) return null;
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    configured = false;
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  configured = true;
  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const mailer = getTransporter();

  if (!mailer) {
    console.log(`\n📧 [ایمیل شبیه‌سازی‌شده] به ${options.to}\nموضوع: ${options.subject}\n`);
    return { ok: true, simulated: true };
  }

  try {
    const info = await mailer.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return { ok: true, providerId: info.messageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "ارسال ایمیل ناموفق بود" };
  }
}

/** قالب ساده و راست‌به‌چپ برای ایمیل‌های کلینیک */
export function emailTemplate(options: {
  clinicName: string;
  title: string;
  body: string;
  footer?: string;
}): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#fdfaf8;font-family:Tahoma,Arial,sans-serif;color:#2a1b23">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #f0e4dd;overflow:hidden">
    <tr><td style="background:#4a2545;padding:20px 24px;color:#fdfaf8;font-size:16px;font-weight:bold">
      ${options.clinicName}
    </td></tr>
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 16px;font-size:18px;color:#2a1b23">${options.title}</h1>
      <div style="font-size:14px;line-height:2;color:#6b5560">${options.body}</div>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#faf4ef;font-size:12px;color:#8a7480">
      ${options.footer ?? "این ایمیل به‌صورت خودکار ارسال شده است."}
    </td></tr>
  </table>
</body></html>`;
}
