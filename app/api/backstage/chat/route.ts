import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify, otherOf } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Chat between Umit and Dilfiraz: one conversation. GET returns the latest
// messages (or only those after ?after=ISO, for polling) and how many of the
// other person's are unread; POST sends one.
const COLS = `id, sender, body, kind, created_at, read_at`;

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const after = new URL(req.url).searchParams.get("after");
  const afterOk = after && !Number.isNaN(Date.parse(after));
  try {
    const [msgs, unread] = await Promise.all([
      afterOk
        ? db().query(`select ${COLS} from chat_messages where date_trunc('milliseconds', created_at) > $1::timestamptz order by created_at limit 200`, [after])
        : db().query(`select * from (select ${COLS} from chat_messages order by created_at desc limit 300) m order by created_at`),
      db().query(`select count(*)::int as n from chat_messages where sender <> $1 and read_at is null`, [auth.me.id]),
    ]);
    // read receipts change on older messages too: send the latest one we can see
    const seen = await db().query(
      `select max(created_at) as at from chat_messages where sender = $1 and read_at is not null`,
      [auth.me.id]
    );
    return NextResponse.json({ messages: msgs.rows, unread: unread.rows[0].n, seen_up_to: seen.rows[0].at });
  } catch (err) {
    console.error("backstage chat read error:", err);
    return NextResponse.json({ error: "Chat couldn't load. Try again in a moment." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const kind = body.kind === "heart" ? "heart" : "text";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "That message is too long (4,000 characters at most)." }, { status: 400 });
  try {
    const r = await db().query(
      `insert into chat_messages (sender, body, kind) values ($1, $2, $3) returning ${COLS}`,
      [auth.me.id, text, kind]
    );
    await notify(otherOf(auth.me.id), {
      title: kind === "heart" ? `${auth.me.name} is thinking of you ❤️` : `💬 ${auth.me.name}`,
      body: kind === "heart" ? "Tap to send one back." : text.slice(0, 180),
      url: "/backstage?view=us",
      tag: kind === "heart" ? "heart" : "chat",
    });
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    console.error("backstage chat send error:", err);
    return NextResponse.json({ error: "Your message didn't send. Try again." }, { status: 500 });
  }
}
