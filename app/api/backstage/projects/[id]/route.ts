import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { cleanTitle, COLOR, DATE, PROJECT_COLS, UUID } from "@/lib/backstage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const name = body.name !== undefined ? cleanTitle(body.name, 120) : undefined;
    if (body.name !== undefined && !name) {
      return NextResponse.json({ error: "Give the project a name." }, { status: 400 });
    }
    let color: string | null = null;
    if (body.color !== undefined) {
      if (typeof body.color !== "string" || !COLOR.test(body.color)) {
        return NextResponse.json({ error: "Unknown colour." }, { status: 400 });
      }
      color = body.color;
    }
    // due_date: "YYYY-MM-DD" sets the deadline, null clears it
    const dueGiven = body.due_date !== undefined;
    if (dueGiven && body.due_date !== null && !(typeof body.due_date === "string" && DATE.test(body.due_date))) {
      return NextResponse.json({ error: "A deadline needs a date." }, { status: 400 });
    }
    if (name === undefined && color === null && !dueGiven) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }
    const r = await db().query(
      `update projects set name = coalesce($2, name), color = coalesce($3, color),
         due_date = case when $4 then $5::date else due_date end
       where id = $1 returning ${PROJECT_COLS}`,
      [id, name ?? null, color, dueGiven, dueGiven ? body.due_date : null]
    );
    if (!r.rows.length) {
      return NextResponse.json({ error: "Unknown project." }, { status: 404 });
    }
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    console.error("backstage project update error:", err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }
  try {
    await db().query(`delete from projects where id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("backstage project delete error:", err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}
