import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { cleanTitle, DATE, PRIORITIES, TASK_COLS, UUID } from "@/lib/backstage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const title = cleanTitle(body.title);
    if (!title) {
      return NextResponse.json({ error: "A task needs a title." }, { status: 400 });
    }
    const projectId =
      typeof body.project_id === "string" && UUID.test(body.project_id)
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
    const r = await db().query(
      `insert into tasks (project_id, title, notes, priority, due_date)
       values ($1, $2, $3, $4, $5)
       returning ${TASK_COLS}`,
      [projectId, title, notes, priority, due]
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
