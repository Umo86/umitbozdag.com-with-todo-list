import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public, non-secret configuration the Backstage client needs before sign-in,
// plus a plain health reading so a broken setup says what is wrong.
export async function GET() {
  let database: "ok" | "missing" | "unreachable" = "missing";
  if (process.env.DATABASE_URL) {
    try {
      await db().query("select 1");
      database = "ok";
    } catch (err) {
      console.error("backstage health: database unreachable:", err);
      database = "unreachable";
    }
  }
  return NextResponse.json({
    authUrl: process.env.NEON_AUTH_BASE_URL ?? "",
    keys: process.env.NEON_AUTH_JWKS_URL ? "ok" : "missing",
    database,
  });
}
