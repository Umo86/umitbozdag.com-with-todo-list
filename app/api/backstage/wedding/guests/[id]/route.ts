import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { GUEST_PEOPLE_MAX, readWedding } from "@/lib/wedding";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Change one guest line: the name, how many people it stands for, or which
// side's list it is on.
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
    const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "A guest needs a name." }, { status: 400 });
    add("name", name);
  }
  if (body.people !== undefined) {
    const n = Number(body.people);
    if (!Number.isInteger(n) || n < 1 || n > GUEST_PEOPLE_MAX) return NextResponse.json({ error: `A line can stand for 1 to ${GUEST_PEOPLE_MAX} people.` }, { status: 400 });
    add("people", n);
  }
  if (body.side !== undefined) {
    if (body.side !== "umit" && body.side !== "dilfiraz") return NextResponse.json({ error: "Choose whose list the guest goes on." }, { status: 400 });
    add("side", body.side);
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    const r = await db().query(`update wedding_guests set ${sets.join(", ")}, updated_at = now() where id = $1 returning id`, vals);
    if (!r.rowCount) return NextResponse.json({ error: "That guest isn't on the list any more." }, { status: 404 });
    return NextResponse.json(await readWedding());
  } catch (err) {
    console.error("wedding guest update error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    await db().query(`delete from wedding_guests where id = $1`, [id]);
    return NextResponse.json(await readWedding());
  } catch (err) {
    console.error("wedding guest delete error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
