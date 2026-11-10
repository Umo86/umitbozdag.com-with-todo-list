import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Marks the other person's messages as read (shows them "Seen").
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  try {
    const r = await db().query(
      `update chat_messages set read_at = now() where sender <> $1 and read_at is null`,
      [auth.me.id]
    );
    return NextResponse.json({ ok: true, marked: r.rowCount });
  } catch (err) {
    console.error("backstage chat mark-read error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
