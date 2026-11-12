import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readWedding, STARTER } from "@/lib/wedding";

export const dynamic = "force-dynamic";

// "Add the usual to-dos": a starter checklist for every area that has a
// known name and no to-dos yet. Nothing is added twice.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  try {
    const { areas } = await readWedding();
    const used = new Set((await db().query(`select distinct area_id from tasks where wedding and area_id is not null`)).rows.map((r) => r.area_id as string));
    let added = 0;
    for (const a of areas) {
      const titles = STARTER[a.name];
      if (!titles || used.has(a.id)) continue;
      for (const [i, title] of titles.entries()) {
        await db().query(
          `insert into tasks (list, title, added_by, updated_by, owner, assignee, wedding, area_id, position)
           values ('personal', $1, $2, $2, 'joint', null, true, $3, (select coalesce(max(position), 0) + 1 from tasks) + $4)`,
          [title, auth.me.id, a.id, i]
        );
        added++;
      }
    }
    return NextResponse.json({ added });
  } catch (err) {
    console.error("wedding starter error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
