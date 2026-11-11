import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fcmReady } from "@/lib/fcm";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// "Send me a test notification": goes to your own phones and browsers a few
// seconds later, so there is time to close the app and watch it arrive.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  try {
    const phones = await db().query(`select count(*)::int as n from fcm_tokens where user_id = $1`, [auth.me.id]);
    const n = phones.rows[0]?.n ?? 0;
    if (!fcmReady()) return NextResponse.json({ error: "Push isn't set up on the server yet (the Firebase key is missing)." }, { status: 503 });
    if (!n) return NextResponse.json({ error: "This phone hasn't registered for push yet. Close Backstage, open it again and allow notifications." }, { status: 409 });
    await new Promise((r) => setTimeout(r, 6000));
    await notify(auth.me.id, { title: "It works 🎉", body: `Hi ${auth.me.name}. Backstage can reach this phone when it’s closed.`, tag: "test" });
    return NextResponse.json({ ok: true, phones: n });
  } catch (err) {
    console.error("push test error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
