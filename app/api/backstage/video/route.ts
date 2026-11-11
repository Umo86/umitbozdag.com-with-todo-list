import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { otherOf } from "@/lib/notify";
import { CHUNK, MAX_BYTES } from "@/lib/video";

export const dynamic = "force-dynamic";

// Start a one-time video (Umit only). The browser then sends the file in
// pieces to /video/[id]/chunk and finishes with /video/[id]/done.
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const size = Number(b.size);
  const mime = typeof b.mime === "string" ? b.mime.slice(0, 80) : "";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) : "";
  if (!/^video\/[a-z0-9.+-]+$/i.test(mime)) return NextResponse.json({ error: "Pick a video file." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "That file looks empty." }, { status: 400 });
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: `That video is too big (the limit is ${Math.round(MAX_BYTES / 1048576)} MB). Trim it or pick a shorter one.` }, { status: 413 });
  }
  try {
    // one at a time: a new video replaces any earlier one that hasn't been watched
    await db().query(`delete from videos where from_user = $1 and watched_at is null`, [auth.me.id]);
    const r = await db().query(
      `insert into videos (from_user, to_user, mime, size, chunks, note) values ($1, $2, $3, $4, $5, nullif($6, '')) returning id`,
      [auth.me.id, otherOf(auth.me.id), mime, size, Math.ceil(size / CHUNK), note]
    );
    return NextResponse.json({ id: r.rows[0].id, chunk: CHUNK }, { status: 201 });
  } catch (err) {
    console.error("video start error:", err);
    return NextResponse.json({ error: "Couldn't start the upload. Try again." }, { status: 500 });
  }
}
