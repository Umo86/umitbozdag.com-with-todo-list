import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  cleanList,
  cleanPosition,
  cleanRepeat,
  cleanTitle,
  cleanWhen,
  DATE,
  PRIORITIES,
  STATUSES,
  TASK_COLS,
  UUID,
} from "@/lib/backstage";
import { nextOccurrence, type Repeat } from "@/lib/parse";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Unknown task." }, { status: 400 });
  }
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const sets: string[] = [];
    const vals: unknown[] = [id];
    const add = (frag: string, v: unknown) => {
      vals.push(v);
      sets.push(frag.replace("?", `$${vals.length}`));
    };

    if (body.title !== undefined) {
      const t = cleanTitle(body.title);
      if (!t) {
        return NextResponse.json({ error: "A task needs a title." }, { status: 400 });
      }
      add("title = ?", t);
    }
    if (body.notes !== undefined) {
      add("notes = ?", typeof body.notes === "string" ? body.notes.slice(0, 4000) : null);
    }
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Unknown status." }, { status: 400 });
      }
      add("status = ?", body.status);
      sets.push(
        body.status === "done" ? "completed_at = now()" : "completed_at = null"
      );
    }
    if (body.priority !== undefined) {
      if (typeof body.priority !== "string" || !PRIORITIES.has(body.priority)) {
        return NextResponse.json({ error: "Unknown priority." }, { status: 400 });
      }
      add("priority = ?", body.priority);
    }
    if (body.due_date !== undefined) {
      const due =
        typeof body.due_date === "string" && DATE.test(body.due_date)
          ? body.due_date
          : null;
      add("due_date = ?", due);
    }
    if (body.project_id !== undefined) {
      const pid =
        typeof body.project_id === "string" && UUID.test(body.project_id)
          ? body.project_id
          : null;
      add("project_id = ?", pid);
    }
    if (body.list !== undefined) {
      const l = cleanList(body.list);
      if (!l) {
        return NextResponse.json({ error: "Unknown list." }, { status: 400 });
      }
      add("list = ?", l);
    }
    if (body.remind_at !== undefined) {
      if (body.remind_at === null) {
        add("remind_at = ?", null);
      } else {
        const when = cleanWhen(body.remind_at);
        if (!when) {
          return NextResponse.json(
            { error: "A reminder needs a date and time with a time zone." },
            { status: 400 }
          );
        }
        add("remind_at = ?", when);
      }
    }
    if (body.repeat !== undefined) {
      if (body.repeat !== null && !cleanRepeat(body.repeat)) {
        return NextResponse.json({ error: "Unknown repeat." }, { status: 400 });
      }
      add("repeat = ?", cleanRepeat(body.repeat));
    }
    if (body.position !== undefined) {
      const p = cleanPosition(body.position);
      if (p === null) {
        return NextResponse.json({ error: "Position must be a number." }, { status: 400 });
      }
      add("position = ?", p);
    }
    if (!sets.length) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }
    sets.push("updated_at = now()");

    // Finishing a repeating task creates the next one (once).
    const before =
      body.status === "done"
        ? await db().query(`select status from tasks where id = $1`, [id])
        : null;

    const r = await db().query(
      `update tasks set ${sets.join(", ")} where id = $1 returning ${TASK_COLS}, next_id`,
      vals
    );
    if (!r.rows.length) {
      return NextResponse.json({ error: "Unknown task." }, { status: 404 });
    }
    const { next_id, ...row } = r.rows[0];
    let spawned = null;
    if (before?.rows[0]?.status !== "done" && row.status === "done" && row.repeat && !next_id) {
      spawned = await spawnNext(row);
    }
    return NextResponse.json(spawned ? { ...row, spawned } : row);
  } catch (err) {
    console.error("backstage task update error:", err);
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
    return NextResponse.json({ error: "Unknown task." }, { status: 400 });
  }
  try {
    await db().query(`delete from tasks where id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("backstage task delete error:", err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}

// The next copy of a repeating task: same details, next date, reminder moved
// by the same number of days (in London time, so it keeps its clock time).
async function spawnNext(row: Record<string, unknown>) {
  const london = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const from = typeof row.due_date === "string" ? row.due_date : london;
  let next = nextOccurrence(from, row.repeat as Repeat);
  // a long-overdue repeat jumps forward to the first date from today
  for (let i = 0; next < london && i < 400; i++) next = nextOccurrence(next, row.repeat as Repeat);
  const r = await db().query(
    `insert into tasks
       (list, project_id, title, notes, priority, due_date, remind_at, added_by, repeat, position)
     values ($1, $2, $3, $4, $5, $6::date,
       case when $7::timestamptz is null then null
            else ((($7::timestamptz at time zone 'Europe/London')
                   + ($6::date - coalesce($8::date, (now() at time zone 'Europe/London')::date)) * interval '1 day')
                  at time zone 'Europe/London') end,
       $9, $10,
       coalesce((select min(position) - 1 from tasks where list = $1 and status = 'todo'), 0))
     returning ${TASK_COLS}`,
    [row.list, row.project_id, row.title, row.notes, row.priority, next,
     row.remind_at, row.due_date, row.added_by, row.repeat]
  );
  await db().query(`update tasks set next_id = $2 where id = $1`, [row.id, r.rows[0].id]);
  return r.rows[0];
}
