import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UUID } from "@/lib/backstage";
import { CHUNK } from "@/lib/video";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One piece of the video: PUT /video/[id]/chunk?i=3 with the raw bytes.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const i = Number(new URL(req.url).searchParams.get("i"));
  if (!UUID.test(id) || !Number.isInteger(i) || i < 0) return NextResponse.json({ error: "Bad piece." }, { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > CHUNK) return NextResponse.json({ error: "Bad piece size." }, { status: 400 });
  try {
    const v = await db().query(`select chunks from videos where id = $1 and from_user = $2 and not ready`, [id, auth.me.id]);
    if (!v.rows[0] || i >= v.rows[0].chunks) return NextResponse.json({ error: "That upload isn't open any more." }, { status: 404 });
    await db().query(
      `insert into video_chunks (video_id, idx, data) values ($1, $2, $3) on conflict (video_id, idx) do update set data = excluded.data`,
      [id, i, buf]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("video chunk error:", err);
    return NextResponse.json({ error: "A piece didn't upload. Trying again…" }, { status: 500 });
  }
}
