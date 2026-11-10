import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, USERS } from "@/lib/auth";
import {
  BUSY_COLS,
  EVENT_COLS,
  PROJECT_COLS,
  seedIfFirstRun,
  TASK_COLS,
  TASK_ORDER,
  visibleTo,
} from "@/lib/backstage";

export const dynamic = "force-dynamic";

// Everything one person sees: their own and the joint tasks, projects and
// events, the other person's private events as "Busy", and (Umit only) the
// website's contact messages.
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const me = auth.me;
  try {
    await seedIfFirstRun();
    const [projects, tasks, events, busy, messages] = await Promise.all([
      db().query(`select ${PROJECT_COLS} from projects where ${visibleTo(1)} order by position, created_at`, [me.id]),
      db().query(`select ${TASK_COLS} from tasks where ${visibleTo(1)} ${TASK_ORDER}`, [me.id]),
      db().query(`select ${EVENT_COLS}, false as busy from events where ${visibleTo(1)} order by coalesce(start_date::timestamptz, starts_at)`, [me.id]),
      db().query(`select ${BUSY_COLS} from events where owner not in ($1, 'joint')`, [me.id]),
      me.admin
        ? db()
            .query(
              `select id, name, email, company, message, created_at, read_at
               from messages order by created_at desc limit 200`
            )
            .catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
    ]);
    return NextResponse.json({
      me,
      users: USERS.map(({ id, name, color }) => ({ id, name, color })),
      projects: projects.rows,
      tasks: tasks.rows,
      events: [...events.rows, ...busy.rows],
      messages: messages.rows,
    });
  } catch (err) {
    console.error("backstage state error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
