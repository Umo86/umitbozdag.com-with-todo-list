import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EVENT_COLS } from "@/lib/backstage";
import { readEvent } from "@/lib/events";
import { notify, otherOf } from "@/lib/notify";

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
    if (r.rows[0].owner === "joint" && r.rows[0].assignee !== auth.me.id) {
      const e = r.rows[0];
      const when = e.all_day
        ? new Date(e.start_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
        : new Date(e.starts_at).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      await notify(otherOf(auth.me.id), {
        title: `📅 ${auth.me.name} added to the calendar`,
        body: `${e.title} · ${when}`,
        url: "/backstage?view=calendar",
        tag: `event-${e.id}`,
      });
    }
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    console.error("backstage event create error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
