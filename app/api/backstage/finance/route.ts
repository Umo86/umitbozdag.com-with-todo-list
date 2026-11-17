import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readTransaction, validMonth } from "@/lib/finance";
import { FINANCE_COLS, financeError } from "@/lib/finance-db";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(req); if (!auth.ok) return auth.res;
  const month = new URL(req.url).searchParams.get("month");
  if (!validMonth(month)) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
  try {
    const [transactions, budgets] = await Promise.all([
      db().query(`select ${FINANCE_COLS} from finance_transactions where owner = $1 and deleted_at is null and occurred_on >= $2::date and occurred_on < ($2::date + interval '1 month') order by occurred_on desc, created_at desc`, [auth.me.id, month + "-01"]),
      db().query("select category, amount_pence::float8 as amount_pence from finance_budgets where owner = $1 and month = $2::date order by category", [auth.me.id, month + "-01"]),
    ]);
    return NextResponse.json({ transactions: transactions.rows, budgets: budgets.rows });
  } catch (error) { return financeError(error); }
}
export async function POST(req: Request) {
  const auth = await requireUser(req); if (!auth.ok) return auth.res;
  let input; try { input = readTransaction(await req.json()); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const t = input;
    const result = await db().query(`insert into finance_transactions (owner, kind, amount_pence, description, category, occurred_on, notes) values ($1,$2,$3,$4,$5,$6::date,$7) returning ${FINANCE_COLS}`, [auth.me.id, t.kind, t.amount_pence, t.description, t.category, t.occurred_on, t.notes]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) { return financeError(error); }
}
