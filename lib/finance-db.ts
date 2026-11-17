import { NextResponse } from "next/server";
export const FINANCE_COLS = "id, owner, kind, amount_pence::float8 as amount_pence, description, category, to_char(occurred_on, 'YYYY-MM-DD') as occurred_on, notes, created_at, updated_at, deleted_at";
export function financeError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "42P01") return NextResponse.json({ error: "Finance is waiting for its one-time setup. Your existing records are unchanged.", code: "FINANCE_SETUP_REQUIRED" }, { status: 503 });
  console.error("Finance request failed", code || "unknown");
  return NextResponse.json({ error: "Finance couldn’t save or load right now. Please try again." }, { status: 500 });
}
