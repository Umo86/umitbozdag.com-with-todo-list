import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkFileLink, requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";
import { showsInline } from "@/lib/files";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Open or download an attached file. For whoever can see its task (signed
// in), or anyone holding a five-minute link to this one file (the phone app
// passes such a link to the phone's browser). The file is sent piece by
// piece, so its size is never held in memory at once.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  let row: { name: string; mime: string; size: number; chunks: number } | undefined;
  if (token) {
    if (!(await checkFileLink(token, id))) return new Response("This link has run out. Open the file from Backstage again.", { status: 403 });
    row = (await db().query(`select name, mime, size::float8 as size, chunks from task_files where id = $1 and ready`, [id])).rows[0];
  } else {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.res;
    row = (
      await db().query(
        `select f.name, f.mime, f.size::float8 as size, f.chunks from task_files f join tasks t on t.id = f.task_id
         where f.id = $1 and f.ready and t.owner in ($2, 'joint')`,
        [id, auth.me.id]
      )
    ).rows[0];
  }
  if (!row) return new Response("That file isn't there any more.", { status: 404 });

  let i = 0;
  const total = row.chunks;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= total) return controller.close();
      try {
        const r = await db().query(`select data from task_file_chunks where file_id = $1 and idx = $2`, [id, i++]);
        if (!r.rows[0]) return controller.error(new Error("A piece of the file is missing."));
        controller.enqueue(new Uint8Array(r.rows[0].data as Buffer));
      } catch (err) {
        controller.error(err);
      }
    },
  });
  const inline = showsInline(row.mime) && !url.searchParams.has("dl");
  const ascii = row.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(body, {
    headers: {
      "Content-Type": row.mime, // (a download is never run as a page, whatever its type)
      "Content-Length": String(row.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": token ? "private, no-store" : "private, max-age=86400, immutable",
    },
  });
}

// Remove a file from a task (anyone who can see the task).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    await db().query(
      `delete from task_files f using tasks t where f.id = $1 and t.id = f.task_id and t.owner in ($2, 'joint')`,
      [id, auth.me.id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("file delete error:", err);
    return NextResponse.json({ error: "Couldn't delete that file. Try again." }, { status: 500 });
  }
}
