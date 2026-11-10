import { NextResponse, after } from "next/server";
import changelog from "@/lib/changelog.json";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Which version of Backstage is live, so open pages (and the installed
// Android app, which loads this site) reload themselves when it changes.
// The first time a new version is asked about, both people get a
// notification with what's new (once per changelog entry).
export async function GET() {
  const latest = changelog[0];
  if (latest) after(() => announce(latest.title, latest.items));
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "", title: latest?.title ?? "", items: latest?.items ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

let announced = "";
async function announce(title: string, items: string[]) {
  if (announced === title) return;
  try {
    const r = await db().query(
      `insert into app_announcements (title) values ($1) on conflict do nothing returning title`,
      [title]
    );
    announced = title;
    if (!r.rowCount) return;
    const note = { title: `Backstage updated: ${title}`, body: items.slice(0, 2).join(" · "), url: "/backstage", tag: "update" };
    await Promise.all([notify("umit", note), notify("dilfiraz", note)]);
  } catch (err) {
    console.error("announce error:", err);
  }
}
