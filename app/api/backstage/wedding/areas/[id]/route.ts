import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cleanMoney, readWedding } from "@/lib/wedding";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rename an area, or set its budget and what has been spent.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [id];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    if (!name) return NextResponse.json({ error: "An area needs a name." }, { status: 400 });
    add("name", name);
  }
  if (body.emoji !== undefined) add("emoji", typeof body.emoji === "string" && body.emoji.trim() ? body.emoji.trim().slice(0, 16) : null);
  for (const k of ["budget", "spent"] as const) {
    if (body[k] === undefined) continue;
    const m = cleanMoney(body[k]);
    if (m === undefined) return NextResponse.json({ error: "That isn't a valid amount." }, { status: 400 });
    add(k, m);
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    const r = await db().query(`update wedding_areas set ${sets.join(", ")}, updated_at = now() where id = $1 returning id`, vals);
    if (!r.rowCount) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(await readWedding());
  } catch (err) {
    console.error("wedding area update error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

// Remove an area. Its to-dos are kept: they just no longer belong to an area.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    await db().query(`update tasks set area_id = null, updated_at = now() where area_id = $1`, [id]);
    await db().query(`delete from wedding_areas where id = $1`, [id]);
    return NextResponse.json(await readWedding());
  } catch (err) {
    console.error("wedding area delete error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
