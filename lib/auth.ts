import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

// Backstage is behind one password, held in the BACKSTAGE_PASSWORD setting
// (never in the code: this repository is public). A correct password earns a
// signed, HttpOnly session cookie that lasts 30 days; changing the password
// signs everyone out, because the password is part of the signing key.
export const SESSION_COOKIE = "backstage_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const sha = (s: string) => createHash("sha256").update(s).digest();
const password = () => process.env.BACKSTAGE_PASSWORD ?? "";
const signingKey = () =>
  sha(
    `backstage-session|${password()}|${
      process.env.BACKSTAGE_SECRET ?? process.env.DATABASE_URL ?? ""
    }`
  );

export function passwordConfigured(): boolean {
  return password().length > 0;
}

export function checkPassword(given: unknown): boolean {
  if (typeof given !== "string" || !passwordConfigured()) return false;
  return timingSafeEqual(sha(given), sha(password()));
}

export async function issueSession(): Promise<string> {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

const isHttps = (req: Request) =>
  (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https";

export function sessionCookie(req: Request, token: string | null): string {
  const base = `${SESSION_COOKIE}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax${
    isHttps(req) ? "; Secure" : ""
  }`;
  return token ? `${base}; Max-Age=${MAX_AGE_SECONDS}` : `${base}; Max-Age=0`;
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// A browser sends Origin on every request that changes something. If it is
// there, it must be this site: another site can't ride on the cookie.
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type Role = "owner" | "helper";
export type AuthResult =
  | { ok: true; userId: string; email: string; name: string; role: Role }
  | { ok: false; res: NextResponse };

const refuse = (status: number, error: string): AuthResult => ({
  ok: false,
  res: NextResponse.json({ error }, { status }),
});

export async function requireOwner(req: Request): Promise<AuthResult> {
  if (!passwordConfigured()) return refuse(503, "Backstage has no password set on the server.");
  if (req.method !== "GET" && !sameOrigin(req)) return refuse(403, "That request came from another site.");
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return refuse(401, "Enter the password to open Backstage.");
  try {
    await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
  } catch {
    return refuse(401, "Your session has ended. Enter the password again.");
  }
  return { ok: true, userId: "owner", email: "", name: "Umit", role: "owner" };
}

// There is one way in now, so a member is the owner. Kept so the routes that
// were written for owner-or-helper read the same.
export const requireMember = requireOwner;
