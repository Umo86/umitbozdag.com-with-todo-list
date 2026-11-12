import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueFileLink, requireUser } from "@/lib/auth";
import { UUID } from "@/lib/backstage";

export const dynamic = "force-dynamic";

// A link to this one file that works for five minutes without being signed
// in. The phone app has no way to save or open a PDF or an Office file
// itself, so it hands this link to the phone's own browser, which downloads
// the file and offers to open it. The link uses the www address: the app
// treats that as "another site" and passes it to the browser.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const f = await db().query(
    `select f.id from task_files f join tasks t on t.id = f.task_id where f.id = $1 and f.ready and t.owner in ($2, 'joint')`,
    [id, auth.me.id]
  );
  if (!f.rows.length) return NextResponse.json({ error: "That file isn't there any more." }, { status: 404 });
  const here = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? here.host;
  const proto = req.headers.get("x-forwarded-proto") ?? here.protocol.replace(":", "");
  // umitbozdag.com -> www.umitbozdag.com (which sends the browser straight back here)
  const out = /^[a-z0-9-]+\.[a-z]{2,}$/i.test(host) ? `www.${host}` : host;
  const token = await issueFileLink(id);
  return NextResponse.json({ url: `${proto}://${out}/api/backstage/files/${id}?dl=1&t=${token}` });
}
