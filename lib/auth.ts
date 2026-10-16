import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "./db";

// Verifies a Neon Auth (Managed Better Auth) bearer token and limits
// Backstage to the owner's email(s). ALLOWED_EMAILS is a comma-separated
// list; it defaults to the site owner.
const DEFAULT_OWNER = "umitbozdag@googlemail.com";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    const url = process.env.NEON_AUTH_JWKS_URL;
    if (!url) throw new Error("NEON_AUTH_JWKS_URL is not set.");
    jwks = createRemoteJWKSet(new URL(url));
  }
  return jwks;
}
function getIssuer(): string {
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base) throw new Error("NEON_AUTH_BASE_URL is not set.");
  return new URL(base).origin;
}
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? DEFAULT_OWNER)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const emailCache = new Map<string, string>();

async function emailForUser(userId: string): Promise<string | null> {
  const cached = emailCache.get(userId);
  if (cached) return cached;
  const lookups = [
    `select email from neon_auth."user" where id = $1`,
    `select email from neon_auth.users_sync where id = $1`,
  ];
  for (const sql of lookups) {
    try {
      const r = await db().query(sql, [userId]);
      const email: string | undefined = r.rows[0]?.email?.toLowerCase();
      if (email) {
        emailCache.set(userId, email);
        return email;
      }
    } catch {
      // table shape differs between Neon Auth generations; try the next
    }
  }
  return null;
}

export type AuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; res: NextResponse };

export async function requireOwner(req: Request): Promise<AuthResult> {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Sign in to use Backstage." }, { status: 401 }),
    };
  }
  let userId: string;
  let claimEmail: string | undefined;
  try {
    const { payload } = await jwtVerify(header.slice(7), getJwks(), {
      issuer: getIssuer(),
    });
    if (!payload.sub) throw new Error("no sub");
    userId = payload.sub;
    if (typeof payload.email === "string") claimEmail = payload.email;
  } catch {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Your session has expired. Sign in again." },
        { status: 401 }
      ),
    };
  }
  const email = (claimEmail ?? (await emailForUser(userId)))?.toLowerCase();
  if (!email || !allowedEmails().includes(email)) {
    return {
      ok: false,
      res: NextResponse.json(
        {
          error: `Backstage is limited to its owner. You are signed in as ${
            email ?? "an unknown account"
          }.`,
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true, userId, email };
}
