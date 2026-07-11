import { log } from "@/lib/logger"

type WelcomeEmailInput = {
  email: string
  name?: string | null
}

type SendEmailInput = {
  to: string
  subject: string
  html?: string
  text?: string
  attachments?: unknown[]
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return sendSmtpEmail(input)
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "GROWZZY OS <notifications@growzzyos.com>",
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    log("warn", "email", "Email send failed", { status: response.status, subject: input.subject, body })
  }
}

async function sendSmtpEmail(input: SendEmailInput): Promise<void> {
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587)
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD

  if (!host || !user || !pass) {
    log("warn", "email", "No Resend or SMTP credentials configured; email skipped", { subject: input.subject })
    return
  }

  try {
    // nodemailer is already in dependencies; require keeps this file usable without extra type packages.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require("nodemailer")
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || user,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
  } catch (error: any) {
    log("warn", "email", "SMTP email failed", { subject: input.subject, message: error?.message })
  }
}

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
  const firstName = input.name?.trim() || "there"

  await sendEmail({
    to: input.email,
    subject: "Welcome to GROWZZY OS Beta",
    html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Hi ${firstName},</h2>
          <p>Welcome to the GROWZZY OS beta. You're one of our first users and your feedback will shape the product.</p>
          <p>Here's what you can do right now:</p>
          <ul>
            <li>Connect your Google Ads account in Settings</li>
            <li>Run an AI audit to see optimization recommendations</li>
            <li>Generate AI-powered ad creatives</li>
            <li>Set up automations to protect your budget</li>
          </ul>
          <p>If you have any questions or feedback, just reply to this email.</p>
          <p>The GROWZZY OS Team</p>
        </div>
      `,
  })
}

export async function sendPasswordResetEmail(input: { email: string; resetUrl: string }): Promise<void> {
  await sendEmail({
    to: input.email,
    subject: "Reset your GROWZZY OS password",
    text: `Reset your password: ${input.resetUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>Reset your password</h2>
        <p>Use the secure link below to reset your GROWZZY OS password. This link expires in 30 minutes.</p>
        <p><a href="${input.resetUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">Reset password</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })
}

export async function sendEmailVerification(input: { email: string; verifyUrl: string; name?: string | null }): Promise<void> {
  const firstName = input.name?.trim() || "there"
  await sendEmail({
    to: input.email,
    subject: "Verify your GROWZZY OS email",
    text: `Verify your email: ${input.verifyUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>Hi ${firstName}, verify your email</h2>
        <p>Confirm your email address to finish securing your GROWZZY OS account.</p>
        <p><a href="${input.verifyUrl}" style="display:inline-block;background:#2147E6;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">Verify email</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
  })
}
