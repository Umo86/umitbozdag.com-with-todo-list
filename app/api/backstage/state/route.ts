import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { seedIfFirstRun, TASK_COLS, TASK_ORDER } from "@/lib/backstage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireMember(req);
  if (!auth.ok) return auth.res;
  try {
    const who = { email: auth.email, name: auth.name, role: auth.role };

    // A helper sees the Personal list only — no projects, no Work.
    if (auth.role === "helper") {
      const tasks = await db().query(
        `select ${TASK_COLS} from tasks where list = 'personal' ${TASK_ORDER}`
      );
      return NextResponse.json({ ...who, projects: [], tasks: tasks.rows });
    }

    await seedIfFirstRun();
    const [projects, tasks] = await Promise.all([
      db().query(
        `select id, name, color, position from projects order by position, created_at`
      ),
      db().query(`select ${TASK_COLS} from tasks ${TASK_ORDER}`),
    ]);
    return NextResponse.json({
      ...who,
      projects: projects.rows,
      tasks: tasks.rows,
    });
  } catch (err) {
    console.error("backstage state error:", err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}
