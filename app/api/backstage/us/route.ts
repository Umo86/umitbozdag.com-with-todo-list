import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readUs, US_COLS, US_KINDS, type UsKind } from "@/lib/us";

export const dynamic = "force-dynamic";

// Add a countdown, memory, idea, shopping item, gift idea, mood or vote.
// Moods (one per person per day) and votes (one per idea per day) replace
// the earlier one.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = body.kind as UsKind;
  if (!US_KINDS.includes(kind)) return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  const r = readUs(kind, body, auth.me, false);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  try {
    if (kind === "mood") {
      await db().query(`delete from us_items where kind = 'mood' and added_by = $1 and day = $2::date`, [auth.me.id, r.fields.day]);
    }
    if (kind === "vote") {
      await db().query(`delete from us_items where kind = 'vote' and added_by = $1 and day = $2::date and ref = $3`, [
        auth.me.id,
        r.fields.day,
        r.fields.ref,
      ]);
    }
    const keys = Object.keys(r.fields);
    const row = await db().query(
      `insert into us_items (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning ${US_COLS}`,
      keys.map((k) => r.fields[k])
    );
    return NextResponse.json(row.rows[0], { status: 201 });
  } catch (err) {
    console.error("backstage us create error:", err);
    return NextResponse.json({ error: "That didn't save. Try again." }, { status: 500 });
  }
}

// Clear today's dinner votes (yours), to swipe again.
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const what = new URL(req.url).searchParams.get("what");
  try {
    if (what === "my-votes") {
      await db().query(`delete from us_items where kind = 'vote' and added_by = $1`, [auth.me.id]);
      return NextResponse.json({ ok: true });
    }
    if (what === "ticked-shopping") {
      await db().query(`delete from us_items where kind = 'shopping' and done`);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Nothing to clear." }, { status: 400 });
  } catch (err) {
    console.error("backstage us clear error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
