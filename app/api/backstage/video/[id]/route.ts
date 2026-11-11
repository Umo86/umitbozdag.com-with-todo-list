import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UUID } from "@/lib/backstage";

export const dynamic = "force-dynamic";

// Take a video back before it has been watched (the sender only).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const r = await db().query(`delete from videos where id = $1 and from_user = $2 and watched_at is null returning id`, [id, auth.me.id]);
  return r.rowCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "It has already been watched." }, { status: 409 });
}
