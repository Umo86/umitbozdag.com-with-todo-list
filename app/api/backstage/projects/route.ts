import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cleanList, cleanOwner, cleanTitle, DATE, PROJECT_COLS } from "@/lib/backstage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const name = cleanTitle(body.name, 120);
    if (!name) {
      return NextResponse.json({ error: "Give the project a name." }, { status: 400 });
    }
    const color =
      typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)
        ? body.color
        : "#a61c2b";
    const owner = cleanOwner(body.owner, auth.me);
    if (!owner) return NextResponse.json({ error: "A project is yours or joint." }, { status: 400 });
    const due = typeof body.due_date === "string" && DATE.test(body.due_date) ? body.due_date : null;
    // Work or Personal; Work when nothing is said
    let list = "work";
    if (body.list !== undefined) {
      const l = cleanList(body.list);
      if (!l) return NextResponse.json({ error: "A project is Work or Personal." }, { status: 400 });
      list = l;
    }
    const r = await db().query(
      `insert into projects (name, color, due_date, owner, list, position)
       values ($1, $2, $3, $4, $5, coalesce((select max(position) + 1 from projects), 0))
       returning ${PROJECT_COLS}`,
      [name, color, due, owner, list]
    );
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    console.error("backstage project create error:", err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}
