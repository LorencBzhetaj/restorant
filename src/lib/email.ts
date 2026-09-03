import "server-only";
import nodemailer from "nodemailer";

/**
 * Email provider abstraction.
 * ---------------------------
 * If SMTP credentials are present in the environment, real emails are sent.
 * Otherwise the app runs in DEMO mode: the email is not delivered, but its
 * content is returned/logged so the flow works end-to-end without credentials.
 *
 * Configure in production via env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 *   NEXT_PUBLIC_APP_URL (used to build links inside emails)
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

let transporter: nodemailer.Transporter | null = null;
function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(msg: EmailMessage): Promise<{ delivered: boolean; demo: boolean }> {
  if (!msg.to) return { delivered: false, demo: true };
  if (!isEmailConfigured()) {
    // Demo mode — do not actually send.
    console.log(`[email:demo] to=${msg.to} subject="${msg.subject}"`);
    return { delivered: false, demo: true };
  }
  try {
    await getTransport().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return { delivered: true, demo: false };
  } catch (e) {
    console.error("[email] send failed", e);
    return { delivered: false, demo: false };
  }
}
