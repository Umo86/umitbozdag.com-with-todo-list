import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";
import { cleanFileName, FILE_CHUNK, FILE_MAX, fileMime, FILES_PER_TASK, FILES_TOTAL_MAX, sweepFiles } from "@/lib/files";

export const dynamic = "force-dynamic";

const mb = (n: number) => `${Math.round(n / 1048576)} MB`;

// Start attaching a file to a task you can see. The browser then sends the
// file in pieces to /files/[id]/chunk and finishes with /files/[id]/done.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown task." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = cleanFileName(b.name);
  const size = Number(b.size);
  if (!name) return NextResponse.json({ error: "That file has no name." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: `${name} is empty.` }, { status: 400 });
  if (size > FILE_MAX) {
    return NextResponse.json({ error: `${name} is ${mb(size)}. The limit is ${mb(FILE_MAX)} a file.` }, { status: 413 });
  }
  try {
    const t = await db().query(`select id from tasks where id = $1 and owner in ($2, 'joint')`, [id, auth.me.id]);
    if (!t.rows.length) return NextResponse.json({ error: "Unknown task." }, { status: 404 });
    await sweepFiles();
    const used = await db().query(
      `select (select count(*)::int from task_files where task_id = $1) as here,
              (select coalesce(sum(size), 0)::float8 from task_files) as bytes`,
      [id]
    );
    if (used.rows[0].here >= FILES_PER_TASK) {
      return NextResponse.json({ error: `A task holds up to ${FILES_PER_TASK} files. Remove one first.` }, { status: 409 });
    }
    if (used.rows[0].bytes + size > FILES_TOTAL_MAX) {
      return NextResponse.json({ error: "Backstage's file space is full. Delete some old files first." }, { status: 507 });
    }
    const r = await db().query(
      `insert into task_files (task_id, name, mime, size, chunks, added_by) values ($1, $2, $3, $4, $5, $6) returning id`,
      [id, name, fileMime(name, b.mime), size, Math.ceil(size / FILE_CHUNK), auth.me.id]
    );
    return NextResponse.json({ id: r.rows[0].id, chunk: FILE_CHUNK }, { status: 201 });
  } catch (err) {
    console.error("file start error:", err);
    return NextResponse.json({ error: "Couldn't start the upload. Try again." }, { status: 500 });
  }
}
