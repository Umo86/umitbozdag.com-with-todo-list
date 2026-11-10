import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";
import { canEdit, readUs, US_COLS, type UsKind } from "@/lib/us";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function find(id: string) {
  const r = await db().query(`select id, kind, owner, added_by from us_items where id = $1`, [id]);
  return r.rows[0] as { id: string; kind: UsKind; owner: string; added_by: string } | undefined;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown item." }, { status: 400 });
  try {
    const item = await find(id);
    if (!item || !canEdit(item, auth.me)) return NextResponse.json({ error: "Unknown item." }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const r = readUs(item.kind, body, auth.me, true);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    const keys = Object.keys(r.fields);
    if (!keys.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    const row = await db().query(
      `update us_items set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() where id = $1 returning ${US_COLS}`,
      [id, ...keys.map((k) => r.fields[k])]
    );
    return NextResponse.json(row.rows[0]);
  } catch (err) {
    console.error("backstage us update error:", err);
    return NextResponse.json({ error: "That didn't save. Try again." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown item." }, { status: 400 });
  try {
    const item = await find(id);
    if (!item || !canEdit(item, auth.me)) return NextResponse.json({ error: "Unknown item." }, { status: 404 });
    await db().query(`delete from us_items where id = $1`, [id]);
    if (item.kind === "idea") await db().query(`delete from us_items where kind = 'vote' and ref = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("backstage us delete error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
