import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UUID } from "@/lib/backstage";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// All pieces are in: check them, make the video available and tell the other person.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const v = await db().query(`select to_user, size::float8 as size, chunks from videos where id = $1 and from_user = $2 and not ready`, [id, auth.me.id]);
    if (!v.rows[0]) return NextResponse.json({ error: "That upload isn't open any more." }, { status: 404 });
    const c = await db().query(`select count(*)::int as n, coalesce(sum(octet_length(data)), 0)::float8 as bytes from video_chunks where video_id = $1`, [id]);
    if (c.rows[0].n !== v.rows[0].chunks || c.rows[0].bytes !== v.rows[0].size) {
      return NextResponse.json({ error: "The upload didn't finish. Try sending it again." }, { status: 409 });
    }
    await db().query(`update videos set ready = true, created_at = now() where id = $1`, [id]);
    await notify(v.rows[0].to_user, { title: `${auth.me.name} has a video for you 🎁`, body: "You can watch it once. Open Backstage.", tag: "video" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("video done error:", err);
    return NextResponse.json({ error: "Couldn't finish the upload. Try again." }, { status: 500 });
  }
}
