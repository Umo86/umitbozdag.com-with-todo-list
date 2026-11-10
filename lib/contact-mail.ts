import type { Row } from "./visitor";

// The email Umit gets for each contact-form message.
export const CONTACT_TO = process.env.CONTACT_TO || "umitbozdag@live.com";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function contactMail(
  e: { name: string; email: string; company: string; message: string },
  info: { server: Row[]; device: Row[] },
  test = false
) {
  const who: Row[] = [["Name", e.name], ["Email", e.email], ["Company", e.company], ["Sent", new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }) + " (London)"]].filter(([, v]) => v) as Row[];
  const block = (title: string, rows: Row[]) =>
    `<h3 style="margin:22px 0 8px;font:600 15px system-ui">${title}</h3><table style="border-collapse:collapse;font:14px system-ui;width:100%">${rows
      .map(([k, v]) => `<tr><td style="padding:6px 10px;border:1px solid #e3e6ee;background:#f6f7fb;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #e3e6ee;word-break:break-word">${/^https?:\/\//.test(v) ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)}</td></tr>`)
      .join("")}</table>`;
  const textBlock = (title: string, rows: Row[]) => `${title}\n${rows.map(([k, v]) => `  ${k}: ${v}`).join("\n")}`;
  return {
    to: CONTACT_TO,
    subject: `${test ? "[TEST] " : ""}Contact form: umitbozdag.com`,
    replyTo: e.email,
    html: `<div style="max-width:680px;font:15px system-ui;color:#0b0b0c">${test ? '<p style="background:#fff7e6;border:1px solid #f2c46c;padding:10px 12px;border-radius:8px">This is a test of the contact form email. Reply goes to the sender\'s address.</p>' : ""}<h2 style="margin:0 0 6px;font:700 20px system-ui">New message from ${esc(e.name)}</h2><blockquote style="margin:14px 0;padding:14px 16px;background:#f3f5ff;border-left:4px solid #1a47ff;white-space:pre-wrap">${esc(e.message)}</blockquote>${block("Sender", who)}${block("Network and browser", info.server)}${block("Device", info.device)}<p style="color:#6b7280;font-size:12px;margin-top:20px">Reply to this email to answer ${esc(e.name)} directly. Location is approximate (from the IP address).</p></div>`,
    text: `New message from ${e.name}\n\n${e.message}\n\n${textBlock("Sender", who)}\n\n${textBlock("Network and browser", info.server)}\n\n${textBlock("Device", info.device)}`,
  };
}
