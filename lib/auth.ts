import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "./db";

// Verifies a Neon Auth (Managed Better Auth) bearer token. Backstage has two
// roles:
//   owner  — ALLOWED_EMAILS (comma-separated; defaults to the site owner):
//            everything.
//   helper — HELPER_EMAILS (comma-separated, optional — e.g. a partner):
//            can see the Personal list and add tasks to it, nothing else.
// Google treats googlemail.com and gmail.com as one mailbox and may report
// either, so both spellings of the owner's address are accepted by default.
const DEFAULT_OWNER = "umitbozdag@googlemail.com,umitbozdag@gmail.com";

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

// Who a token belongs to, read from Neon Auth's own user table rather than
// trusted from the token: the email must be VERIFIED. Without that check
// anyone could register the owner's address with a password of their own
// and be let in. Verified users are cached briefly; unverified never.
type Account = { email: string; name: string | null; verified: boolean };
const accountCache = new Map<string, { at: number; account: Account }>();
const ACCOUNT_TTL_MS = 60_000;

async function accountForUser(userId: string): Promise<Account | null> {
  const hit = accountCache.get(userId);
  if (hit && Date.now() - hit.at < ACCOUNT_TTL_MS) return hit.account;
  const r = await db().query(
    `select email, name, "emailVerified" as verified from neon_auth."user" where id = $1`,
    [userId]
  );
  const row = r.rows[0];
  if (!row?.email) return null;
  const account: Account = {
    email: String(row.email).toLowerCase(),
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 80) : null,
    verified: row.verified === true,
  };
  if (account.verified) accountCache.set(userId, { at: Date.now(), account });
  return account;
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
  try {
    const { payload } = await jwtVerify(header.slice(7), getJwks(), {
      issuer: getIssuer(),
    });
    if (!payload.sub) throw new Error("no sub");
    userId = payload.sub;
  } catch {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Your session has expired. Sign in again." },
        { status: 401 }
      ),
    };
  }
  const account = await accountForUser(userId);
  if (!account) return { ok: true, userId, email: null, name: null };
  if (!account.verified) {
    return {
      ok: false,
      res: NextResponse.json(
        {
          error: "Confirm your email address to open Backstage.",
          code: "unverified",
          email: account.email,
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true, userId, email: account.email, name: account.name };
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
