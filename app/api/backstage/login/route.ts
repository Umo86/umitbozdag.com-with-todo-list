import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkPassword,
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
    return NextResponse.json(
      { error: "Backstage has no password set on the server." },
      { status: 503 }
    );
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "That request came from another site." }, { status: 403 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  let tries = 0;
  try {
    const r = await db().query(
      `select count(*)::int as n from login_attempts where ip = $1 and at > now() - interval '${WINDOW}'`,
      [ip]
    );
    tries = r.rows[0]?.n ?? 0;
  } catch {
    // no database, no counting: the password check below still applies
  }
  if (tries >= LIMIT) {
    return NextResponse.json(
      { error: "Too many wrong passwords. Wait fifteen minutes and try again." },
      { status: 429 }
    );
  }

  if (!checkPassword(body.password)) {
    await db()
      .query(`insert into login_attempts (ip) values ($1)`, [ip])
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }

  await db()
    .query(`delete from login_attempts where ip = $1 or at < now() - interval '1 day'`, [ip])
    .catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookie(req, await issueSession()));
  return res;
}
