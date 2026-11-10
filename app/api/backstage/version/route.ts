import { NextResponse } from "next/server";


export const dynamic = "force-dynamic";

// Which version of Backstage is live, so open pages (and the installed
// Android app, which loads this site) reload themselves when it changes.
export async function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
