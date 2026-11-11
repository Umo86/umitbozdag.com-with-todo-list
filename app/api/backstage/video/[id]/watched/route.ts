import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// It has been watched: note when, delete the file for good, tell the sender.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const r = await db().query(`update videos set watched_at = now() where id = $1 and to_user = $2 and watched_at is null returning from_user`, [id, auth.me.id]);
    await db().query(`delete from video_chunks where video_id = $1 and exists (select 1 from videos where id = $1 and to_user = $2)`, [id, auth.me.id]);
    if (r.rows[0]) await notify(r.rows[0].from_user, { title: `${auth.me.name} watched your video ❤️`, body: "It has now been deleted.", tag: "video" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("video watched error:", err);
    return NextResponse.json({ error: "Try again." }, { status: 500 });
  }
}
