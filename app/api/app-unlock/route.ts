import { db } from "@/lib/db";
import { appPassCookie, checkLogin, ensureUsers, issueAppPass, sameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The password box on /app. Same password as Umit's Backstage, same limit on
// wrong guesses (ten in fifteen minutes per address).
const WINDOW = "15 minutes";
const LIMIT = 10;
const back = (req: Request, to: string, cookie?: string) => {
  const headers = new Headers({ Location: new URL(to, req.url).pathname + new URL(to, req.url).search, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
};

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const next = String(form?.get("next") ?? "/app");
  const to = next === "/app/updates" ? next : "/app";
  if (!sameOrigin(req)) return back(req, `${to}?nope=1`);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  try {
    await ensureUsers();
    const r = await db().query(
      `select count(*)::int as n from login_attempts where ip = $1 and at > now() - interval '${WINDOW}'`,
      [ip]
    );
    if ((r.rows[0]?.n ?? 0) >= LIMIT) return back(req, `${to}?nope=locked`);
  } catch {
    return back(req, `${to}?nope=down`);
  }
  const ok = await checkLogin("umit", String(form?.get("password") ?? ""));
  if (!ok) {
    await db().query(`insert into login_attempts (ip) values ($1)`, [ip]).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
    return back(req, `${to}?nope=${1 + Math.floor(Math.random() * 6)}`);
  }
  return back(req, to, appPassCookie(req, await issueAppPass()));
}
