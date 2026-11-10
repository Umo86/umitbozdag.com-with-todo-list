import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// The public contact form. Messages are stored in the database and read in
// Backstage. `fallback: true` tells the browser to open the visitor's own
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
    company: text(b.company, 160),
    message: text(b.message, 4000),
  };
  if (!entry.name || !EMAIL.test(entry.email) || entry.message.length < 5) {
    return NextResponse.json(
      { error: "Please add your name, a valid email and a short message." },
      { status: 400 }
    );
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Messages can't be stored here.", fallback: true }, { status: 503 });
  }
  try {
    await db().query(
      `insert into messages (name, email, company, message) values ($1, $2, nullif($3, ''), $4)`,
      [entry.name, entry.email, entry.company, entry.message]
    );
    recent.set(ip, now);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("contact form error:", err);
    return NextResponse.json({ error: "Messages can't be stored right now.", fallback: true }, { status: 503 });
  }
}
