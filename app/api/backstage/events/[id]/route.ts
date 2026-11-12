import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EVENT_COLS, UUID } from "@/lib/backstage";
import { readEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Change or delete an event you can see (yours or joint).
/** Is this the calendar entry for the wedding day itself (made when the date was set)? */
async function isWeddingDay(id: string): Promise<boolean> {
  const r = await db().query(`select 1 from wedding_plan where id = 1 and event_id = $1`, [id]);
  return !!r.rowCount;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const ev = readEvent(body, auth.me, true);
  if (!ev.ok) return NextResponse.json({ error: ev.error }, { status: 400 });
  try {
    // "Our wedding" is the wedding date itself: it stays a joint wedding
    // entry, and moving it moves the date (and the countdown) with it.
    const theDay = await isWeddingDay(id);
    if (theDay) for (const k of ["owner", "assignee", "wedding", "work", "shared", "repeat"]) delete ev.fields[k];
    const keys = Object.keys(ev.fields);
    if (!keys.length) return NextResponse.json({ error: theDay ? "This is your wedding day: it stays on the joint calendar." : "Nothing to change." }, { status: 400 });
    const r = await db().query(
      `update events set ${keys.map((k, i) => (k === "work" || k === "shared" ? `${k} = ($${i + 3}::boolean and ${ev.fields.owner === undefined ? "owner <> 'joint'" : "true"})` : `${k} = $${i + 3}`)).join(", ")}, updated_at = now()
       where id = $1 and owner in ($2, 'joint') returning ${EVENT_COLS}, false as busy`,
      [id, auth.me.id, ...keys.map((k) => ev.fields[k])]
    );
    if (!r.rows.length) return NextResponse.json({ error: "Unknown event." }, { status: 404 });
    if (theDay) {
      await db().query(
        `update wedding_plan set wedding_date = coalesce(e.start_date, (e.starts_at at time zone 'Europe/London')::date), updated_at = now(), updated_by = $2
         from events e where wedding_plan.id = 1 and e.id = $1`,
        [id, auth.me.id]
      );
    }
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    console.error("backstage event update error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  try {
    if (await isWeddingDay(id)) {
      return NextResponse.json({ error: "That's your wedding day. To take it off the calendar, clear the date in Wedding › Edit details." }, { status: 409 });
    }
    await db().query(`delete from events where id = $1 and owner in ($2, 'joint')`, [id, auth.me.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("backstage event delete error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
