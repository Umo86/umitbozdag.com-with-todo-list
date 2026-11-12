import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";
import { FILE_COLS } from "@/lib/files";
import { notify, otherOf } from "@/lib/notify";

export const dynamic = "force-dynamic";

// All pieces are in: check them and make the file available on the task.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const f = await db().query(`select size::float8 as size, chunks from task_files where id = $1 and added_by = $2 and not ready`, [id, auth.me.id]);
    if (!f.rows[0]) return NextResponse.json({ error: "That upload isn't open any more." }, { status: 404 });
    const c = await db().query(`select count(*)::int as n, coalesce(sum(octet_length(data)), 0)::float8 as bytes from task_file_chunks where file_id = $1`, [id]);
    if (c.rows[0].n !== f.rows[0].chunks || c.rows[0].bytes !== f.rows[0].size) {
      return NextResponse.json({ error: "The upload didn't finish. Try attaching it again." }, { status: 409 });
    }
    const r = await db().query(
      `update task_files f set ready = true, created_at = now() from tasks t
       where f.id = $1 and t.id = f.task_id returning ${FILE_COLS}, t.title, t.owner, t.wedding`,
      [id]
    );
    const { title, owner, wedding, ...file } = r.rows[0];
    // a file on a joint task: tell the other person
    if (owner === "joint") {
      await notify(otherOf(auth.me.id), {
        title: `📎 ${auth.me.name} added a file`,
        body: `${file.name} · on “${title}”`,
        url: `/backstage?view=${wedding ? "wedding" : "joint"}`,
        tag: `file-${file.task_id}`,
      });
    }
    return NextResponse.json(file);
  } catch (err) {
    console.error("file done error:", err);
    return NextResponse.json({ error: "Couldn't finish the upload. Try again." }, { status: 500 });
  }
}
