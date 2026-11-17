import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UUID } from "@/lib/backstage";
import { readTransaction } from "@/lib/finance";
import { FINANCE_COLS, financeError } from "@/lib/finance-db";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Context) {
  const auth = await requireUser(req); if (!auth.ok) return auth.res;
  const { id } = await ctx.params; if (!UUID.test(id)) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Enter the transaction details." }, { status: 400 });
  let input;
  if (body.restore !== true) try { input = readTransaction(body); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const result = input
      ? await db().query(`update finance_transactions set kind=$3, amount_pence=$4, description=$5, category=$6, occurred_on=$7::date, notes=$8, updated_at=now() where id=$1 and owner=$2 and deleted_at is null returning ${FINANCE_COLS}`, [id, auth.me.id, input.kind, input.amount_pence, input.description, input.category, input.occurred_on, input.notes])
      : await db().query(`update finance_transactions set deleted_at=null, updated_at=now() where id=$1 and owner=$2 returning ${FINANCE_COLS}`, [id, auth.me.id]);
    if (!result.rows.length) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (error) { return financeError(error); }
}
export async function DELETE(req: Request, ctx: Context) {
  const auth = await requireUser(req); if (!auth.ok) return auth.res;
  const { id } = await ctx.params; if (!UUID.test(id)) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  try {
    const result = await db().query("update finance_transactions set deleted_at=now(), updated_at=now() where id=$1 and owner=$2 and deleted_at is null returning id", [id, auth.me.id]);
    if (!result.rows.length) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return financeError(error); }
}
