import { NextResponse } from "next/server";
import { latestRelease } from "@/lib/app-download";

export const dynamic = "force-dynamic";

// Public release metadata only; no user, finance or database information.
export async function GET() {
  return NextResponse.json(await latestRelease(), { headers: { "Cache-Control": "no-store" } });
}
