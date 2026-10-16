import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public, non-secret configuration the Backstage client needs before sign-in.
export async function GET() {
  return NextResponse.json({
    authUrl: process.env.NEON_AUTH_BASE_URL ?? "",
  });
}
