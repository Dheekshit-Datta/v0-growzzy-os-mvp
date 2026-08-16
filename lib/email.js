var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { log } from "@/lib/logger";
export function sendEmail(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            return sendSmtpEmail(input);
        }
        const response = yield fetch("https://api.resend.com/emails", {
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
        });
        if (!response.ok) {
            const body = yield response.text().catch(() => "");
            log("warn", "email", "Email send failed", { status: response.status, subject: input.subject, body });
        }
    });
}
function sendSmtpEmail(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST;
        const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587);
        const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER;
        const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD;
        if (!host || !user || !pass) {
            log("warn", "email", "No Resend or SMTP credentials configured; email skipped", { subject: input.subject });
            return;
        }
        try {
            // nodemailer is already in dependencies; require keeps this file usable without extra type packages.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const nodemailer = require("nodemailer");
            const transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
            yield transporter.sendMail({
                from: process.env.SMTP_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || user,
                to: input.to,
                subject: input.subject,
                html: input.html,
                text: input.text,
            });
        }
        catch (error) {
            log("warn", "email", "SMTP email failed", { subject: input.subject, message: error === null || error === void 0 ? void 0 : error.message });
        }
    });
}
export function sendWelcomeEmail(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const firstName = ((_a = input.name) === null || _a === void 0 ? void 0 : _a.trim()) || "there";
        yield sendEmail({
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
        });
    });
}
export function sendPasswordResetEmail(input) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sendEmail({
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
        });
    });
}
export function sendEmailVerification(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const firstName = ((_a = input.name) === null || _a === void 0 ? void 0 : _a.trim()) || "there";
        yield sendEmail({
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
        });
    });
}
