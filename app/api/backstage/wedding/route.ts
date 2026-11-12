import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cleanCount, cleanMoney, readWedding } from "@/lib/wedding";

export const dynamic = "force-dynamic";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Change the wedding's details: the date, the venue, the capacity and each
// side's guests, the budget. Setting the date also puts "Our wedding" on the
// joint calendar (and moves or removes it when the date changes).
export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (body.wedding_date !== undefined) {
    if (body.wedding_date !== null && !(typeof body.wedding_date === "string" && DATE.test(body.wedding_date))) return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
    add("wedding_date", body.wedding_date);
  }
  if (body.venue !== undefined) add("venue", typeof body.venue === "string" && body.venue.trim() ? body.venue.trim().slice(0, 200) : null);
  for (const k of ["capacity", "guests_umit", "guests_dilfiraz"] as const) {
    if (body[k] === undefined) continue;
    const n = cleanCount(body[k]);
    if (n === undefined) return NextResponse.json({ error: "Guest numbers must be whole numbers." }, { status: 400 });
    add(k, n);
  }
  if (body.budget !== undefined) {
    const m = cleanMoney(body.budget);
    if (m === undefined) return NextResponse.json({ error: "That budget isn't a valid amount." }, { status: 400 });
    add("budget", m);
  }
  if (!sets.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    await readWedding(); // makes sure the plan exists
    add("updated_by", auth.me.id);
    const r = await db().query(
      `update wedding_plan set ${sets.join(", ")}, updated_at = now() where id = 1 returning to_char(wedding_date, 'YYYY-MM-DD') as wedding_date, event_id`,
      vals
    );
    // keep the day itself on the joint calendar, in the wedding colour
    if (body.wedding_date !== undefined) {
      const { wedding_date: day, event_id: ev } = r.rows[0];
      if (day && ev) {
        const moved = await db().query(`update events set start_date = $1, end_date = null, updated_at = now() where id = $2 returning id`, [day, ev]);
        if (!moved.rowCount) await db().query(`update wedding_plan set event_id = null where id = 1`);
      }
      const still = (await db().query(`select event_id from wedding_plan where id = 1`)).rows[0]?.event_id;
      if (day && !still) {
        const made = await db().query(
          `insert into events (owner, assignee, added_by, title, all_day, start_date, wedding) values ('joint', 'both', $1, '💍 Our wedding', true, $2, true) returning id`,
          [auth.me.id, day]
        );
        await db().query(`update wedding_plan set event_id = $1 where id = 1`, [made.rows[0].id]);
      } else if (!day && still) {
        await db().query(`delete from events where id = $1`, [still]);
        await db().query(`update wedding_plan set event_id = null where id = 1`);
      }
    }
    return NextResponse.json(await readWedding());
  } catch (err) {
    console.error("wedding update error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
