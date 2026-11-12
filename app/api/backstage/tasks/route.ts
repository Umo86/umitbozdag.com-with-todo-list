import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify, otherOf } from "@/lib/notify";
import {
  cleanAssignee,
  cleanList,
  cleanOwner,
  cleanPosition,
  cleanRepeat,
  cleanTitle,
  cleanWhen,
  DATE,
  JOINT,
  PRIORITIES,
  TASK_COLS,
  UUID,
} from "@/lib/backstage";

export const dynamic = "force-dynamic";

// Add a task to your own list (Work or Personal) or to the joint list.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const me = auth.me;
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const title = cleanTitle(body.title);
    if (!title) return NextResponse.json({ error: "A task needs a title." }, { status: 400 });

    // a wedding to-do is always joint: both of you see all of the wedding planning
    const wedding = body.wedding === true;
    const owner = wedding ? JOINT : cleanOwner(body.owner, me);
    if (!owner) return NextResponse.json({ error: "You can add to your own list or the joint one." }, { status: 400 });

    let list = "personal";
    if (body.list !== undefined) {
      const l = cleanList(body.list);
      if (!l) return NextResponse.json({ error: "Unknown list." }, { status: 400 });
      list = l;
    }
    if (owner === JOINT) list = "personal";

    let remindAt: string | null = null;
    if (body.remind_at !== undefined && body.remind_at !== null) {
      remindAt = cleanWhen(body.remind_at);
      if (!remindAt) {
        return NextResponse.json({ error: "A reminder needs a date and time with a time zone." }, { status: 400 });
      }
    }
    const projectId = typeof body.project_id === "string" && UUID.test(body.project_id) ? body.project_id : null;
    const due = typeof body.due_date === "string" && DATE.test(body.due_date) ? body.due_date : null;
    const priority = typeof body.priority === "string" && PRIORITIES.has(body.priority) ? body.priority : "normal";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 4000) : null;
    const position = cleanPosition(body.position);
    const repeat = cleanRepeat(body.repeat);
    const assignee = owner === JOINT ? cleanAssignee(body.assignee) : null;

    // New cards go to the top of To do unless a position is given.
    const r = await db().query(
      `insert into tasks
         (list, project_id, title, notes, priority, due_date, remind_at, added_by, repeat, owner, assignee, wedding, area_id, updated_by, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $10, $11, $12, $13, $14, $8,
         coalesce($9::double precision,
           (select min(position) - 1 from tasks where list = $1 and owner = $11 and status = 'todo'),
           0))
       returning ${TASK_COLS}`,
      [list, projectId, title, notes, priority, due, remindAt, me.id, position, repeat, owner, assignee, wedding, wedding && typeof body.area_id === "string" && UUID.test(body.area_id) ? body.area_id : null]
    );
    if (owner === JOINT && assignee !== me.id) {
      await notify(otherOf(me.id), {
        title: `${me.name} added a joint to-do`,
        body: title,
        url: "/backstage?view=joint",
        tag: `task-${r.rows[0].id}`,
      });
    }
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    console.error("backstage task create error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
