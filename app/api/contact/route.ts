import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mailConfigured, sendMail } from "@/lib/mail";
import { visitorRows } from "@/lib/visitor";
import { contactMail, thankYouMail } from "@/lib/contact-mail";

export const dynamic = "force-dynamic";

// The public contact form. Messages are stored in the database (read in
// Backstage) and emailed to Umit with the sender's IP, rough location and
// device details. `fallback: true` tells the browser to open the visitor's own
// email app when the message can't be stored here.
const recent = new Map<string, number>();
const EMAIL = /^[^\s@?&=,<>"']+@[^\s@?&=,<>"']+\.[^\s@?&=,<>"']+$/;
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.website) return NextResponse.json({ ok: true }); // honeypot: bots fill it in

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > 60_000) recent.delete(k);
  if (recent.has(ip) && now - (recent.get(ip) ?? 0) < 30_000) {
    return NextResponse.json(
      { error: "Please wait a moment before sending another message." },
      { status: 429 }
    );
  }

  const entry = {
    name: text(b.name, 120),
    email: text(b.email, 200),
    phone: text(b.phone, 30),
    company: text(b.company, 160),
    message: text(b.message, 4000),
  };
  if (!entry.name || !EMAIL.test(entry.email) || entry.message.length < 5 || entry.phone.replace(/\D/g, "").length < 7) {
    return NextResponse.json(
      { error: "Please add your name, a valid email, a phone number and a short message." },
      { status: 400 }
    );
  }
  const client = (b.client && typeof b.client === "object" ? b.client : {}) as Record<string, unknown>;
  const info = visitorRows(req, client);

  let stored = false;
  if (process.env.DATABASE_URL) {
    try {
      await db().query(
        `insert into messages (name, email, company, message, meta, phone) values ($1, $2, nullif($3, ''), $4, $5, $6)`,
        [entry.name, entry.email, entry.company, entry.message, JSON.stringify(Object.fromEntries([...info.server, ...info.device])), entry.phone]
      );
      stored = true;
    } catch (err) {
      console.error("contact form store error:", err);
    }
  }
  let mailed = false;
  if (mailConfigured()) {
    const r = await sendMail(contactMail(entry, info));
    mailed = r.ok;
    if (!r.ok) console.error("contact form mail error:", r.error);
    // and a short thank-you to the sender
    const t = await sendMail(thankYouMail(entry));
    if (!t.ok) console.error("contact form thank-you error:", t.error);
  }
  if (!stored && !mailed) {
    return NextResponse.json({ error: "Messages can't be sent right now.", fallback: true }, { status: 503 });
  }
  recent.set(ip, now);
  return NextResponse.json({ ok: true }, { status: 201 });
}
