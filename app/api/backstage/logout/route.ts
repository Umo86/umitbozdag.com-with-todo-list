import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookie(req, null));
  return res;
}
