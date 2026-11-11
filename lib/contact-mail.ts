import type { Row } from "./visitor";

// The email Umit gets for each contact-form message.
export const CONTACT_TO = process.env.CONTACT_TO || "umitbozdag@live.com";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function contactMail(
  e: { name: string; email: string; phone?: string; company: string; message: string },
  info: { server: Row[]; device: Row[] },
  test = false
) {
  const sent = new Date().toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "full", timeStyle: "short" }) + " (London time)";
  const who: Row[] = (
    [
      ["Name", e.name],
      ["Email", e.email],
      ["Phone", e.phone ?? ""],
      ["Company", e.company || "(not given)"],
      ["Sent", sent],
    ] as Row[]
  ).filter(([, v]) => v);
  const link = (k: string, v: string) =>
    /^https?:\/\//.test(v)
      ? `<a href="${esc(v)}">${esc(v)}</a>`
      : k === "Email"
        ? `<a href="mailto:${esc(v)}">${esc(v)}</a>`
        : k === "Phone"
          ? `<a href="tel:${esc(v.replace(/[^\d+]/g, ""))}">${esc(v)}</a>`
          : esc(v);
  const H = (t: string) =>
    `<h2 style="margin:0 0 12px;font:800 13px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#1a47ff">${t}</h2>`;
  const sub = (t: string) => `<h3 style="margin:18px 0 6px;font:600 14px system-ui,sans-serif;color:#0b0b0c">${t}</h3>`;
  const table = (rows: Row[], strong = false) =>
    `<table role="presentation" style="border-collapse:collapse;width:100%;font:14px system-ui,sans-serif">${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:7px 12px;border:1px solid #e3e6ee;background:#f6f7fb;width:34%;vertical-align:top;font-weight:600;color:#3b4252">${esc(k)}</td><td style="padding:7px 12px;border:1px solid #e3e6ee;word-break:break-word;${strong ? "font-size:15px;color:#0b0b0c" : "color:#3b4252"}">${link(k, v)}</td></tr>`
      )
      .join("")}</table>`;
  const html = `<div style="max-width:680px;font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;color:#0b0b0c">
${test ? '<p style="background:#fff7e6;border:1px solid #f2c46c;padding:10px 12px;border-radius:8px;margin:0 0 18px">Test email from the contact form.</p>' : ""}
${H("Sender&rsquo;s message")}
<div style="padding:16px 18px;background:#f3f5ff;border-left:4px solid #1a47ff;white-space:pre-wrap;font-size:16px">${esc(e.message)}</div>
${sub("Sender&rsquo;s details")}
${table(who, true)}
<hr style="border:0;border-top:2px solid #0b0b0c;margin:30px 0 22px">
${H("Sender&rsquo;s system info")}
${sub("Network and browser")}
${table(info.server)}
${sub("Device")}
${table(info.device)}
<p style="color:#6b7280;font-size:12px;margin-top:20px">Press Reply to answer ${esc(e.name)} directly. Location is approximate (worked out from the IP address).</p>
</div>`;
  const tx = (rows: Row[]) => rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const text = `SENDER'S MESSAGE\n\n${e.message}\n\nSENDER'S DETAILS\n${tx(who)}\n\n----------------------------------------\nSENDER'S SYSTEM INFO\n\nNetwork and browser\n${tx(info.server)}\n\nDevice\n${tx(info.device)}\n`;
  return {
    to: CONTACT_TO,
    subject: `${test ? "[TEST] " : ""}Contact form: umitbozdag.com`,
    replyTo: e.email,
    html,
    text,
  };
}

/** The short thank-you that goes back to whoever filled in the form. */
export function thankYouMail(e: { name: string; email: string }) {
  const first =
    e.name
      .replace(/https?:\/\/\S+|www\.\S+/gi, "")
      .replace(/[<>{}\[\]\\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "there";
  const text = `Hi ${first},\n\nThank you for reaching out. I will be in touch soon.\n\nRegards,\nUmit Bozdag\n`;
  return {
    to: e.email,
    subject: "Thank you for getting in touch",
    text,
    html: `<div style="font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#0b0b0c"><p>Hi ${esc(first)},</p><p>Thank you for reaching out. I will be in touch soon.</p><p>Regards,<br>Umit Bozdag</p></div>`,
    replyTo: process.env.SMTP_USER || undefined,
  };
}
