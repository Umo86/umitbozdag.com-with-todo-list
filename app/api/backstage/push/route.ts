import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify, pushKey } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Switch browser notifications on (POST a PushSubscription) or off (DELETE).
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  if (!pushKey()) return NextResponse.json({ error: "Notifications aren't set up on the server yet." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; test?: unknown };
  const endpoint = typeof body.endpoint === "string" && /^https:\/\//.test(body.endpoint) ? body.endpoint.slice(0, 1000) : null;
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh.slice(0, 200) : null;
  const key = typeof body.keys?.auth === "string" ? body.keys.auth.slice(0, 100) : null;
  if (!endpoint || !p256dh || !key) return NextResponse.json({ error: "That subscription isn't valid." }, { status: 400 });
  try {
    await db().query(
      `insert into push_subs (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)
       on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      [auth.me.id, endpoint, p256dh, key]
    );
    if (body.test) await notify(auth.me.id, { title: "Notifications are on 🎉", body: "You'll hear about messages, hearts and nudges here.", tag: "test" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push subscribe error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof body.endpoint !== "string") return NextResponse.json({ error: "Which subscription?" }, { status: 400 });
  await db().query(`delete from push_subs where endpoint = $1 and user_id = $2`, [body.endpoint, auth.me.id]).catch(() => {});
  return NextResponse.json({ ok: true });
}
