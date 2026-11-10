import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EVENT_COLS } from "@/lib/backstage";
import { readEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

// Add an event to your own calendar or the joint one.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const ev = readEvent(body, auth.me, false);
  if (!ev.ok) return NextResponse.json({ error: ev.error }, { status: 400 });
  const f = { assignee: null, notes: null, location: null, repeat: null, remind_minutes: null, ...ev.fields, added_by: auth.me.id };
  const keys = Object.keys(f);
  try {
    const r = await db().query(
      `insert into events (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})
       returning ${EVENT_COLS}, false as busy`,
      keys.map((k) => (f as Record<string, unknown>)[k])
    );
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    console.error("backstage event create error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
