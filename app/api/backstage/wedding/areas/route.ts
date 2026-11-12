import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cleanMoney, readWedding } from "@/lib/wedding";

export const dynamic = "force-dynamic";

// Add an area to the wedding planning (Decor, Venue, Catering, anything).
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Give the area a name." }, { status: 400 });
  const emoji = typeof body.emoji === "string" && body.emoji.trim() ? body.emoji.trim().slice(0, 16) : null;
  const budget = body.budget === undefined ? null : cleanMoney(body.budget);
  if (budget === undefined) return NextResponse.json({ error: "That budget isn't a valid amount." }, { status: 400 });
  try {
    await readWedding();
    await db().query(
      `insert into wedding_areas (name, emoji, budget, position) values ($1, $2, $3, (select coalesce(max(position), -1) + 1 from wedding_areas))`,
      [name, emoji, budget]
    );
    return NextResponse.json(await readWedding(), { status: 201 });
  } catch (err) {
    console.error("wedding area create error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
