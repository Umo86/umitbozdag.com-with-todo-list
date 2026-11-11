import { db } from "./db";

// A one-time video from Umit to Dilfiraz. The file is uploaded in pieces
// into Postgres (Neon), streamed back to her once, and deleted as soon as
// she has watched it.
export const CHUNK = 3 * 1024 * 1024; // each piece (under Vercel's request limit)
export const MAX_BYTES = 150 * 1024 * 1024;
const STALE_OPEN = "45 minutes"; // opened but never finished: counts as watched

export type VideoRow = {
  id: string;
  from_user: string;
  to_user: string;
  mime: string;
  size: number;
  chunks: number;
  note: string | null;
  ready: boolean;
  created_at: string;
  opened_at: string | null;
  watched_at: string | null;
};
export const VIDEO_COLS = "id, from_user, to_user, mime, size::float8 as size, chunks, note, ready, created_at, opened_at, watched_at";

/** Opened long ago and never finished? It has had its one showing. */
export async function expireStale(): Promise<void> {
  const r = await db().query(
    `update videos set watched_at = now() where watched_at is null and opened_at is not null and opened_at < now() - interval '${STALE_OPEN}' returning id`
  );
  for (const row of r.rows) await db().query(`delete from video_chunks where video_id = $1`, [row.id]);
  // unfinished uploads from yesterday
  await db().query(`delete from videos where not ready and created_at < now() - interval '1 day'`);
}

/** What the quick check tells each person: a video waiting for me, and the last one I sent. */
export async function videoStatus(me: string) {
  try {
    await expireStale();
    const [inbox, sent] = await Promise.all([
      db().query(`select id, from_user, note, created_at from videos where to_user = $1 and ready and watched_at is null order by created_at desc limit 1`, [me]),
      db().query(`select id, to_user, ready, created_at, opened_at, watched_at from videos where from_user = $1 and ready order by created_at desc limit 1`, [me]),
    ]);
    return { video_in: inbox.rows[0] ?? null, video_out: sent.rows[0] ?? null };
  } catch {
    return { video_in: null, video_out: null };
  }
}
