import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UUID } from "@/lib/backstage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const COLS = `id, name, email, company, message, created_at, read_at`;

// Mark a contact-form message read or unread.
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown message." }, { status: 400 });
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.read !== "boolean") {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }
    const r = await db().query(
      `update messages set read_at = case when $2 then coalesce(read_at, now()) else null end
       where id = $1 returning ${COLS}`,
      [id, body.read]
    );
    if (!r.rows.length) return NextResponse.json({ error: "Unknown message." }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    console.error("backstage message update error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown message." }, { status: 400 });
  try {
    await db().query(`delete from messages where id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("backstage message delete error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
