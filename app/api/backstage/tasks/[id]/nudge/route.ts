import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";

export const dynamic = "force-dynamic";

// Nudge the other person about a joint to-do: counts the nudges and drops a
// note into the chat ("👉 nudged you about the bins (3rd time)").
const nth = (n: number) => (n === 1 ? "" : ` (${n}${n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"} time)`);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown task." }, { status: 400 });
  try {
    const r = await db().query(
      `update tasks set nudges = nudges + 1 where id = $1 and owner = 'joint' and status <> 'done' returning title, nudges`,
      [id]
    );
    if (!r.rows.length) return NextResponse.json({ error: "Only open joint to-dos can be nudged." }, { status: 404 });
    const { title, nudges } = r.rows[0];
    await db().query(`insert into chat_messages (sender, body, kind) values ($1, $2, 'nudge')`, [
      auth.me.id,
      `👉 Nudge about “${title}”${nth(nudges)}`,
    ]);
    return NextResponse.json({ ok: true, nudges });
  } catch (err) {
    console.error("backstage nudge error:", err);
    return NextResponse.json({ error: "The nudge didn't send. Try again." }, { status: 500 });
  }
}
