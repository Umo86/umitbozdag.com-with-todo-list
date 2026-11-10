import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

// Your private calendar link (for Google / Samsung Calendar). GET makes one
// the first time; POST makes a new one, so the old link stops working.
const newToken = () => randomBytes(24).toString("base64url");
// Always on umitbozdag.com, even when asked from the app's older address.
// (Locally, the address you're on, so tests can follow it.)
const feedUrl = (req: Request, token: string) => {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${local ? `http://${host}` : SITE_URL}/api/calendar/${token}`;
};

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  try {
    const r = await db().query(
      `update users set calendar_token = coalesce(calendar_token, $2) where id = $1 returning calendar_token`,
      [auth.me.id, newToken()]
    );
    return NextResponse.json({ ...auth.me, calendar_url: feedUrl(req, r.rows[0].calendar_token) });
  } catch (err) {
    console.error("backstage me error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  try {
    const r = await db().query(`update users set calendar_token = $2 where id = $1 returning calendar_token`, [
      auth.me.id,
      newToken(),
    ]);
    return NextResponse.json({ ...auth.me, calendar_url: feedUrl(req, r.rows[0].calendar_token) });
  } catch (err) {
    console.error("backstage me error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

// Your birthday (so the other person gets a gift reminder two weeks before).
export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const b = body.birthday;
  if (b !== null && !(typeof b === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b))) {
    return NextResponse.json({ error: "Pick a date." }, { status: 400 });
  }
  try {
    await db().query(`update users set birthday = $2::date where id = $1`, [auth.me.id, b]);
    return NextResponse.json({ ok: true, birthday: b });
  } catch (err) {
    console.error("backstage birthday error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
