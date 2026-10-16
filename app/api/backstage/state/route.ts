import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { seedIfFirstRun, TASK_COLS } from "@/lib/backstage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.res;
  try {
    await seedIfFirstRun();
    const [projects, tasks] = await Promise.all([
      db().query(
        `select id, name, color, position from projects order by position, created_at`
      ),
      db().query(`select ${TASK_COLS} from tasks order by created_at desc`),
    ]);
    return NextResponse.json({
      email: auth.email,
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
