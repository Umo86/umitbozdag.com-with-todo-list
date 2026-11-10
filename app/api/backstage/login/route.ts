import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkLogin,
  ensureUsers,
  issueSession,
  passwordConfigured,
  sameOrigin,
  sessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// Wrong guesses are counted per address in the database (so the count holds
// across server instances): ten in fifteen minutes and the door stays shut.
const WINDOW = "15 minutes";
const LIMIT = 10;

export async function POST(req: Request) {
  if (!passwordConfigured()) {
    return NextResponse.json({ error: "Backstage has no password set on the server." }, { status: 503 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "That request came from another site." }, { status: 403 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  let tries = 0;
  try {
    await ensureUsers();
    const r = await db().query(
      `select count(*)::int as n from login_attempts where ip = $1 and at > now() - interval '${WINDOW}'`,
      [ip]
    );
    tries = r.rows[0]?.n ?? 0;
  } catch {
    return NextResponse.json({ error: "Backstage can't reach its database right now." }, { status: 503 });
  }
  if (tries >= LIMIT) {
    return NextResponse.json(
      { error: "Too many wrong passwords. Wait fifteen minutes and try again." },
      { status: 429 }
    );
  }

  // older app versions send only a password: that's Umit
  const me = await checkLogin(body.username ?? "umit", body.password);
  if (!me) {
    await db().query(`insert into login_attempts (ip) values ($1)`, [ip]).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "That name and password don't match." }, { status: 401 });
  }
  await db()
    .query(`delete from login_attempts where ip = $1 or at < now() - interval '1 day'`, [ip])
    .catch(() => {});
  const res = NextResponse.json({ ok: true, name: me.name });
  res.headers.append("Set-Cookie", sessionCookie(req, await issueSession(me)));
  return res;
}
