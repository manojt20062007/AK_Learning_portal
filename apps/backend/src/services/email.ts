import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function isBrevoApiConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY && env.BREVO_API_KEY.trim().length > 0);
}

function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 5000,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

function parseFromHeader(from: string): { name?: string; email: string } {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  }
  return { email: from.trim() };
}

/**
 * Send an email via Brevo HTTP API (preferred on Render) or Brevo SMTP with fast timeouts.
 * Never throws so account creation/payment approval does not roll back on transient email errors.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ sent: boolean; reason?: string }> {
  if (isBrevoApiConfigured()) {
    try {
      const sender = parseFromHeader(env.EMAIL_FROM);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY!.trim(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
          ...(options.text && { textContent: options.text }),
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.error(`Brevo API error (${res.status}): ${errText}`);
        return { sent: false, reason: `Brevo API ${res.status}` };
      }

      logger.info(`Email sent via Brevo HTTP API to ${options.to}: ${options.subject}`);
      return { sent: true };
    } catch (err) {
      logger.error(`Brevo API request failed for ${options.to}:`, err);
      return { sent: false, reason: err instanceof Error ? err.message : 'Brevo API error' };
    }
  }

  if (!isSmtpConfigured()) {
    logger.warn(`Email not configured — skipping email to ${options.to} (${options.subject})`);
    return { sent: false, reason: 'Email not configured' };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    logger.info(`Email sent via Brevo SMTP to ${options.to}: ${options.subject}`);
    return { sent: true };
  } catch (err) {
    logger.error(`Failed to send email to ${options.to}:`, err);
    return { sent: false, reason: err instanceof Error ? err.message : 'SMTP error' };
  }
}

export async function sendStudentInvitationEmail(params: {
  to: string;
  studentName: string;
  studentId: string;
  setupLink: string;
  courseTitle?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const { to, studentName, studentId, setupLink, courseTitle } = params;
  const courseLine = courseTitle
    ? `<p style="margin:0 0 16px;color:#374151;font-size:15px;">You have been enrolled in <strong>${courseTitle}</strong>.</p>`
    : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Welcome to AK Learning!</h1>
      <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Hi ${studentName}, your student account is ready.</p>
      <div style="background:#f3f4f6;border-radius:12px;padding:16px;margin:0 0 20px;">
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Your Student ID</div>
        <div style="font-size:20px;font-weight:700;color:#4f46e5;font-family:monospace;margin-top:4px;">${studentId}</div>
      </div>
      ${courseLine}
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Click the button below to set your password and access your dashboard. This link is valid for 7 days and can only be used once.</p>
      <a href="${setupLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">Set Up Your Password</a>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;word-break:break-all;">Or copy this link: ${setupLink}</p>
    </div>
  `;

  const text = `Welcome to AK Learning, ${studentName}!\nYour Student ID: ${studentId}\n${
    courseTitle ? `Course: ${courseTitle}\n` : ''
  }Set up your password here (valid 7 days): ${setupLink}`;

  return sendEmail({
    to,
    subject: `Welcome to AK Learning — Student ID ${studentId}`,
    html,
    text,
  });
}

export async function sendPaymentRejectedEmail(params: {
  to: string;
  studentName: string;
  utrNumber: string;
  reason?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const { to, studentName, utrNumber, reason } = params;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Payment Verification Update</h1>
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${studentName}, we could not verify your payment submission (UTR: <strong>${utrNumber}</strong>).</p>
      ${reason ? `<p style="margin:0 0 16px;color:#b91c1c;background:#fef2f2;padding:12px;border-radius:8px;font-size:14px;"><strong>Reason:</strong> ${reason}</p>` : ''}
      <p style="margin:0;color:#6b7280;font-size:14px;">Please double-check your UTR number or contact support with your payment screenshot.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `AK Learning — Payment Verification Update (${utrNumber})`,
    html,
  });
}
