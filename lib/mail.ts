// Sends email from the server. Two ways, whichever is set up in Vercel:
//  - Resend: RESEND_API_KEY (and MAIL_FROM once umitbozdag.com is verified there)
//  - any SMTP mailbox: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (MAIL_FROM optional)
// No keys or passwords live in the code: this repository is public.
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string };

export const mailConfigured = () => !!(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));

export async function sendMail(m: Mail): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || "umitbozdag.com <onboarding@resend.dev>",
          to: [m.to],
          subject: m.subject,
          text: m.text,
          html: m.html,
          reply_to: m.replyTo,
        }),
      });
      if (!r.ok) return { ok: false, error: `Resend ${r.status}: ${(await r.text()).slice(0, 300)}` };
      return { ok: true };
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const port = Number(process.env.SMTP_PORT || 465);
      const t = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const fromDomain = process.env.SMTP_USER.split("@")[1] || "umitbozdag.com";
      await t.sendMail({
        // a Message-ID on our own domain (not Vercel's machine name) looks less like spam
        messageId: `<${randomUUID()}@${fromDomain}>`,
        from: process.env.MAIL_FROM || `umitbozdag.com <${process.env.SMTP_USER}>`,
        to: m.to,
        subject: m.subject,
        text: m.text,
        html: m.html,
        replyTo: m.replyTo,
      });
      return { ok: true };
    }
    return { ok: false, error: "No email service set up (RESEND_API_KEY or SMTP_* in Vercel)." };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
