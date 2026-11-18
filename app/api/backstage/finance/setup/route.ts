import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FINANCE_SCHEMA } from "@/scripts/finance-schema.mjs";
import { financeError } from "@/lib/finance-db";
import type { PoolClient } from "pg";

export const dynamic = "force-dynamic";

// Explicit, authenticated setup: only new Finance tables, no seeds or changes to existing tables.
export async function POST(req: Request) {
  const auth = await requireUser(req); if (!auth.ok) return auth.res;
  if (!auth.me.admin) return NextResponse.json({ error: "Umit needs to enable Finance once before either of you can use it." }, { status: 403 });
  let client: PoolClient | undefined;
  try {
    client = await db().connect();
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(721826110)");
    await client.query(FINANCE_SCHEMA);
    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client?.query("rollback").catch(() => {});
    return financeError(error);
  } finally { client?.release(); }
}
