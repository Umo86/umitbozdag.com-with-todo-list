import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { gameMatch, londonToday } from "@/lib/us";
import { videoStatus } from "@/lib/video";

export const dynamic = "force-dynamic";

// Today's moods for both people: a small, quick check the app makes every
// few seconds so a new "how was your day" shows up straight away. It also
// says whether a one-time video is waiting, what happened to the last one
// sent, and what you both said yes to in the dinner and dates games today.
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  try {
    const r = await db().query(
      `select added_by, emoji, updated_at from us_items where kind = 'mood' and owner = 'joint' and day = $1::date`,
      [londonToday()]
    );
    const [dinner, date] = await Promise.all([gameMatch("dinner").catch(() => null), gameMatch("date").catch(() => null)]);
    return NextResponse.json({ moods: r.rows, dinner, date, ...(await videoStatus(auth.me.id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ moods: [] });
  }
}
