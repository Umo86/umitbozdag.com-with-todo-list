import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";

export const dynamic = "force-dynamic";

// Delete (unsend) one of your own chat messages.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown message." }, { status: 400 });
  try {
    const r = await db().query(`delete from chat_messages where id = $1 and sender = $2`, [id, auth.me.id]);
    if (!r.rowCount) return NextResponse.json({ error: "You can only delete your own messages." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("backstage chat delete error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
