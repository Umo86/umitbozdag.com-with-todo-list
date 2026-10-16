import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  cleanTitle,
  DATE,
  PRIORITIES,
  STATUSES,
  TASK_COLS,
  UUID,
} from "@/lib/backstage";

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
    if (!sets.length) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }

    const r = await db().query(
      `update tasks set ${sets.join(", ")} where id = $1 returning ${TASK_COLS}`,
      vals
    );
    if (!r.rows.length) {
      return NextResponse.json({ error: "Unknown task." }, { status: 404 });
    }
    return NextResponse.json(r.rows[0]);
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
