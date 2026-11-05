import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "./db";

// Verifies a Neon Auth (Managed Better Auth) bearer token. Backstage has two
// roles:
//   owner  — ALLOWED_EMAILS (comma-separated; defaults to the site owner):
//            everything.
//   helper — HELPER_EMAILS (comma-separated, optional — e.g. a partner):
//            can see the Personal list and add tasks to it, nothing else.
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
function emailList(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
function ownerEmails(): string[] {
  return emailList(process.env.ALLOWED_EMAILS ?? DEFAULT_OWNER);
}
function helperEmails(): string[] {
  return emailList(process.env.HELPER_EMAILS);
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

export type Role = "owner" | "helper";

export type AuthResult =
  | { ok: true; userId: string; email: string; name: string; role: Role }
  | { ok: false; res: NextResponse };

type Identity =
  | { ok: true; userId: string; email: string | null; name: string | null }
  | { ok: false; res: NextResponse };

async function identify(req: Request): Promise<Identity> {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Sign in to use Backstage." }, { status: 401 }),
    };
  }
  let userId: string;
  let claimEmail: string | undefined;
  let claimName: string | undefined;
  try {
    const { payload } = await jwtVerify(header.slice(7), getJwks(), {
      issuer: getIssuer(),
    });
    if (!payload.sub) throw new Error("no sub");
    userId = payload.sub;
    if (typeof payload.email === "string") claimEmail = payload.email;
    if (typeof payload.name === "string" && payload.name.trim()) {
      claimName = payload.name.trim().slice(0, 80);
    }
  } catch {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Your session has expired. Sign in again." },
        { status: 401 }
      ),
    };
  }
  const email = (claimEmail ?? (await emailForUser(userId)))?.toLowerCase() ?? null;
  return { ok: true, userId, email, name: claimName ?? null };
}

function refused(email: string | null): NextResponse {
  return NextResponse.json(
    {
      error: `Backstage is limited to its owner. You are signed in as ${
        email ?? "an unknown account"
      }.`,
    },
    { status: 403 }
  );
}

// Owner only: projects, editing, moving and deleting tasks.
export async function requireOwner(req: Request): Promise<AuthResult> {
  const id = await identify(req);
  if (!id.ok) return id;
  if (!id.email || !ownerEmails().includes(id.email)) {
    return { ok: false, res: refused(id.email) };
  }
  return { ok: true, userId: id.userId, email: id.email, name: id.name ?? "Umit", role: "owner" };
}

// Owner or helper: reading the board and adding tasks. Routes that use this
// must narrow what a helper sees and does (Personal list only).
export async function requireMember(req: Request): Promise<AuthResult> {
  const id = await identify(req);
  if (!id.ok) return id;
  if (id.email && ownerEmails().includes(id.email)) {
    return { ok: true, userId: id.userId, email: id.email, name: id.name ?? "Umit", role: "owner" };
  }
  if (id.email && helperEmails().includes(id.email)) {
    return {
      ok: true,
      userId: id.userId,
      email: id.email,
      name: id.name ?? id.email.split("@")[0],
      role: "helper",
    };
  }
  return { ok: false, res: refused(id.email) };
}
