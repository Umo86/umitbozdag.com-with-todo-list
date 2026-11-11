import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The heartbeat. Each open Backstage asks this every few seconds; the answer
// is three short fingerprints of everything the person can see:
//   v  tasks, projects, events and the "us" items (lists, votes, moods…)
//   c  the chat (newest message, unread count, newest read receipt)
//   x  one-time videos
// A fingerprint changes when anything behind it changes: added, edited,
// ticked off, moved, deleted, by either person, on any device. The page then
// fetches just that part, so the other person's change shows within seconds.
// Each one is a sum of row hashes, so no column or timestamp can be missed.
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const sum = (table: string, alias: string, where: string) =>
    `(select coalesce(sum(hashtext(${alias}::text)::bigint), 0)::text || ':' || count(*) from ${table} ${alias} where ${where})`;
  try {
    const r = await db().query(
      `select ${sum("tasks", "t", "t.owner in ($1, 'joint')")} as t,
              ${sum("projects", "p", "p.owner in ($1, 'joint')")} as p,
              ${sum("events", "e", "true")} as e,
              ${sum("us_items", "u", "u.owner = 'joint' or u.owner = $1")} as u,
              ${sum("chat_messages", "m", "m.created_at > now() - interval '3 days' or m.read_at is null")} as c,
              ${sum("videos", "w", "true")} as x`,
      [auth.me.id]
    );
    const s = r.rows[0];
    return NextResponse.json(
      { v: `${s.t}|${s.p}|${s.e}`, u: s.u, c: s.c, x: s.x },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("backstage pulse error:", err);
    return NextResponse.json({ error: "No pulse." }, { status: 500 });
  }
}
