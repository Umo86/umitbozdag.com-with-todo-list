import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EVENT_COLS, UUID } from "@/lib/backstage";
import { readEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Change or delete an event you can see (yours or joint).
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const ev = readEvent(body, auth.me, true);
  if (!ev.ok) return NextResponse.json({ error: ev.error }, { status: 400 });
  const keys = Object.keys(ev.fields);
  if (!keys.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    const r = await db().query(
      `update events set ${keys.map((k, i) => `${k} = $${i + 3}`).join(", ")}, updated_at = now()
       where id = $1 and owner in ($2, 'joint') returning ${EVENT_COLS}, false as busy`,
      [id, auth.me.id, ...keys.map((k) => ev.fields[k])]
    );
    if (!r.rows.length) return NextResponse.json({ error: "Unknown event." }, { status: 404 });
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
    await db().query(`delete from events where id = $1 and owner in ($2, 'joint')`, [id, auth.me.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("backstage event delete error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
