import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import {
  cleanList,
  cleanPosition,
  cleanTitle,
  cleanWhen,
  DATE,
  PRIORITIES,
  TASK_COLS,
  UUID,
} from "@/lib/backstage";

export const dynamic = "force-dynamic";

// Owner: add to either list. Helper: add to the Personal list only.
export async function POST(req: Request) {
  const auth = await requireMember(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const title = cleanTitle(body.title);
    if (!title) {
      return NextResponse.json({ error: "A task needs a title." }, { status: 400 });
    }
    const isOwner = auth.role === "owner";

    let list = "personal";
    if (isOwner && body.list !== undefined) {
      const l = cleanList(body.list);
      if (!l) {
        return NextResponse.json({ error: "Unknown list." }, { status: 400 });
      }
      list = l;
    }

    let remindAt: string | null = null;
    if (body.remind_at !== undefined && body.remind_at !== null) {
      remindAt = cleanWhen(body.remind_at);
      if (!remindAt) {
        return NextResponse.json(
          { error: "A reminder needs a date and time with a time zone." },
          { status: 400 }
        );
      }
    }

    const projectId =
      isOwner && typeof body.project_id === "string" && UUID.test(body.project_id)
        ? body.project_id
        : null;
    const due =
      typeof body.due_date === "string" && DATE.test(body.due_date)
        ? body.due_date
        : null;
    const priority =
      typeof body.priority === "string" && PRIORITIES.has(body.priority)
        ? body.priority
        : "normal";
    const notes =
      typeof body.notes === "string" ? body.notes.slice(0, 4000) : null;
    const position = cleanPosition(body.position);
    const addedBy = isOwner ? "umit" : auth.name;

    // New cards go to the top of To do unless a position is given.
    const r = await db().query(
      `insert into tasks
         (list, project_id, title, notes, priority, due_date, remind_at, added_by, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8,
         coalesce($9::double precision,
           (select min(position) - 1 from tasks where list = $1 and status = 'todo'),
           0))
       returning ${TASK_COLS}`,
      [list, projectId, title, notes, priority, due, remindAt, addedBy, position]
    );
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    console.error("backstage task create error:", err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}
