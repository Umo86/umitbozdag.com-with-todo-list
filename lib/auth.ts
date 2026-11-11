import { NextResponse } from "next/server";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

// Backstage has two people, Umit and Dilfiraz, each with a name and a
// password. Passwords are never in the code (this repository is public):
// each person's is stored hashed in the users table, and Umit's can instead
// come from the BACKSTAGE_PASSWORD setting. A correct name and password earn
// a signed, HttpOnly session cookie for 30 days. Changing someone's password
// signs that person out everywhere, because a fingerprint of the password is
// inside their session.

export const SESSION_COOKIE = "backstage_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const sha = (s: string) => createHash("sha256").update(s).digest();
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const USERS = [
  { id: "umit", name: "Umit", color: "#1a47ff", admin: true },
  { id: "dilfiraz", name: "Dilfiraz", color: "#e0457b", admin: false },
] as const;
export type UserId = "umit" | "dilfiraz";
export const USER_IDS = new Set<string>(USERS.map((u) => u.id));

const envPassword = () => process.env.BACKSTAGE_PASSWORD ?? "";
const signingKey = () =>
  sha(`backstage-session|${process.env.BACKSTAGE_SECRET ?? process.env.DATABASE_URL ?? envPassword()}`);

/** True when at least Umit can sign in (his password is set somewhere). */
export function passwordConfigured(): boolean {
  return envPassword().length > 0;
}

// ——— password hashing (scrypt, stored as "scrypt$<salt b64>$<hash b64>") ———
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
async function verifyHash(pw: string, stored: string): Promise<boolean> {
  const [kind, s, h] = stored.split("$");
  if (kind !== "scrypt" || !s || !h) return false;
  const want = Buffer.from(h, "base64");
  const got = await scrypt(pw, Buffer.from(s, "base64"), want.length);
  return timingSafeEqual(got, want);
}

type UserRow = { id: string; name: string; color: string; admin: boolean; password_hash: string | null };
export type Me = { id: UserId; name: string; color: string; admin: boolean };

/** Makes sure both people exist (without passwords; those are set separately). */
export async function ensureUsers(): Promise<void> {
  for (const u of USERS) {
    await db().query(
      `insert into users (id, name, color, admin) values ($1, $2, $3, $4) on conflict (id) do nothing`,
      [u.id, u.name, u.color, u.admin]
    );
  }
}

async function loadUser(id: string): Promise<UserRow | null> {
  const r = await db().query(
    `select id, name, color, admin, password_hash from users where id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

// The secret behind a person's password, used only as a fingerprint.
const secretOf = (u: UserRow) => u.password_hash ?? (u.id === "umit" ? envPassword() : "");
const fingerprint = (u: UserRow) => sha(`pv|${secretOf(u)}`).toString("base64url").slice(0, 16);

/** The person, if the name and password match. Names are matched loosely. */
export async function checkLogin(username: unknown, password: unknown): Promise<Me | null> {
  if (typeof username !== "string" || typeof password !== "string" || !password) return null;
  const id = username.trim().toLowerCase();
  if (!USER_IDS.has(id)) {
    await scrypt(password, randomBytes(16), 32); // same time either way
    return null;
  }
  const u = await loadUser(id);
  if (!u) return null;
  let ok = false;
  if (u.password_hash) ok = await verifyHash(password, u.password_hash);
  else if (u.id === "umit" && envPassword()) ok = timingSafeEqual(sha(password), sha(envPassword()));
  return ok ? { id: u.id as UserId, name: u.name, color: u.color, admin: u.admin } : null;
}

export async function issueSession(me: Me): Promise<string> {
  const u = await loadUser(me.id);
  return new SignJWT({ pv: u ? fingerprint(u) : "" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(me.id)
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

export type AuthResult = { ok: true; me: Me } | { ok: false; res: NextResponse };

const refuse = (status: number, error: string): AuthResult => ({
  ok: false,
  res: NextResponse.json({ error }, { status }),
});

/** Either person, signed in. */
export async function requireUser(req: Request): Promise<AuthResult> {
  if (!passwordConfigured()) return refuse(503, "Backstage has no password set on the server.");
  if (req.method !== "GET" && !sameOrigin(req)) return refuse(403, "That request came from another site.");
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return refuse(401, "Sign in to open Backstage.");
  let sub = "";
  let pv = "";
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    sub = String(payload.sub ?? "");
    pv = String(payload.pv ?? "");
  } catch {
    return refuse(401, "Your session has ended. Sign in again.");
  }
  if (!USER_IDS.has(sub)) return refuse(401, "Your session has ended. Sign in again.");
  let u: UserRow | null;
  try {
    u = await loadUser(sub);
  } catch {
    return refuse(503, "Backstage can't reach its database right now.");
  }
  if (!u || fingerprint(u) !== pv) return refuse(401, "Your password changed. Sign in again.");
  return { ok: true, me: { id: u.id as UserId, name: u.name, color: u.color, admin: u.admin } };
}

/** Umit only (the website's contact messages). */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const a = await requireUser(req);
  if (a.ok && !a.me.admin) return refuse(403, "Only Umit can see this.");
  return a;
}

// ——— the app download pages (/app): locked with their own password ———
// APP_PAGE_PASSWORD_HASH holds that password as a scrypt hash ("scrypt:<salt>:<hash>",
// never the password itself). Without the setting the pages open with Umit's
// Backstage password. Signed in to Backstage on this device? Then they're open too.
export const APP_PASS_COOKIE = "app_pass";
const appHash = () => (process.env.APP_PAGE_PASSWORD_HASH ?? "").trim().replace(/:/g, "$");
// changes when the password does, so passes earned with an old one stop working
const appVersion = () => (appHash() ? sha(`app|${appHash()}`).toString("base64url").slice(0, 12) : "app");

/** Is this the password for the app pages? */
export async function checkAppPassword(password: unknown): Promise<boolean> {
  if (typeof password !== "string" || !password) return false;
  if (appHash()) return verifyHash(password, appHash());
  return !!(await checkLogin("umit", password));
}

export async function issueAppPass(): Promise<string> {
  return new SignJWT({ pv: appVersion() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("app-page")
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

export function appPassCookie(req: Request, token: string): string {
  return `${APP_PASS_COOKIE}=${token}; Path=/app; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${isHttps(req) ? "; Secure" : ""}`;
}

/** Can whoever sent these cookies see the app pages? */
export async function appAccess(cookieHeader: string): Promise<boolean> {
  const req = new Request("https://umitbozdag.com/app", { headers: { cookie: cookieHeader } });
  const pass = readCookie(req, APP_PASS_COOKIE);
  if (pass) {
    try {
      const { payload } = await jwtVerify(pass, signingKey(), { algorithms: ["HS256"] });
      if (payload.sub === "app-page" && payload.pv === appVersion()) return true;
    } catch {
      /* fall through */
    }
  }
  if (!readCookie(req, SESSION_COOKIE)) return false;
  return (await requireUser(req)).ok;
}
