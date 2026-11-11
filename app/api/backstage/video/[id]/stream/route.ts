import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";
import { CHUNK } from "@/lib/video";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Plays the video to the person it was sent to, a few megabytes per request
// (the player asks for the next part itself). Only while it is unwatched.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const v = (await db().query(`select mime, size::float8 as size, chunks from videos where id = $1 and to_user = $2 and ready and watched_at is null`, [id, auth.me.id])).rows[0];
  if (!v) return new Response("This video has already been watched.", { status: 410 });
  const size: number = v.size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  let start = 0;
  let end = size - 1;
  if (m) {
    if (m[1] === "" && m[2] !== "") start = Math.max(0, size - Number(m[2])); // last N bytes
    else {
      start = Number(m[1] || 0);
      if (m[2] !== "") end = Math.min(size - 1, Number(m[2]));
    }
  }
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  end = Math.min(end, start + CHUNK - 1); // at most one piece's worth per answer
  const first = Math.floor(start / CHUNK);
  const last = Math.floor(end / CHUNK);
  const rows = (await db().query(`select idx, data from video_chunks where video_id = $1 and idx between $2 and $3 order by idx`, [id, first, last])).rows;
  if (rows.length !== last - first + 1) return new Response("Missing data", { status: 500 });
  const all = Buffer.concat(rows.map((r) => r.data as Buffer));
  const body = all.subarray(start - first * CHUNK, end - first * CHUNK + 1);
  if (start === 0) await db().query(`update videos set opened_at = coalesce(opened_at, now()) where id = $1`, [id]).catch(() => {});
  return new Response(new Uint8Array(body), {
    status: 206,
    headers: {
      "Content-Type": v.mime,
      "Content-Length": String(body.length),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
