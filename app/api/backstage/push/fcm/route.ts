import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The Android app tells the server its push address (a Firebase token) each
// time it opens, and takes it back when the person signs out. A phone belongs
// to whoever is signed in on it now.
const clean = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_:\-.]{20,4096}$/.test(v) ? v : null);

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const token = clean(((await req.json().catch(() => ({}))) as { token?: unknown }).token);
  if (!token) return NextResponse.json({ error: "That push address isn't valid." }, { status: 400 });
  try {
    await db().query(
      `insert into fcm_tokens (token, user_id) values ($1, $2)
       on conflict (token) do update set user_id = excluded.user_id, last_seen = now()`,
      [token, auth.me.id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("fcm register error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const token = clean(((await req.json().catch(() => ({}))) as { token?: unknown }).token);
  if (!token) return NextResponse.json({ ok: true });
  await db()
    .query(`delete from fcm_tokens where token = $1 and user_id = $2`, [token, auth.me.id])
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
