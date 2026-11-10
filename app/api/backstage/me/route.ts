import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Your private calendar link (for Google / Samsung Calendar). GET makes one
// the first time; POST makes a new one, so the old link stops working.
const newToken = () => randomBytes(24).toString("base64url");
const feedUrl = (req: Request, token: string) => {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}/api/calendar/${token}`;
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
