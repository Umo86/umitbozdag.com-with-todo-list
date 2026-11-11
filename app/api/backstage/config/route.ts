import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { passwordConfigured } from "@/lib/auth";
import { fcmReady } from "@/lib/fcm";

export const dynamic = "force-dynamic";

// A plain health reading for the sign-in screen, so a broken setup says what
// is wrong. No secrets: only whether each piece is in place.
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
    password: passwordConfigured() ? "ok" : "missing",
    database,
    // push to the Android app (Firebase Cloud Messaging): is the server's side set up?
    fcm: fcmReady() ? "ok" : "missing",
    // public key for browser notifications (Web Push); empty = not set up
    push_key: process.env.VAPID_PUBLIC_KEY ?? "",
  });
}
