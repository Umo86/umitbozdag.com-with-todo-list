import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readBudgets, validMonth } from "@/lib/finance";
import { financeError } from "@/lib/finance-db";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const auth = await requireUser(req); if (!auth.ok) return auth.res;
  const raw = await req.json().catch(() => ({}));
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (!validMonth(body.month)) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
  let budgets; try { budgets = readBudgets(body.budgets); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    // One statement saves all entered categories atomically; omitted limits stay untouched.
    if (budgets.length) await db().query(`with changes as (select * from jsonb_to_recordset($3::jsonb) as b(category text, amount_pence bigint)), removed as (delete from finance_budgets f using changes c where f.owner=$1 and f.month=$2::date and f.category=c.category and c.amount_pence is null) insert into finance_budgets (owner,month,category,amount_pence) select $1,$2::date,category,amount_pence from changes where amount_pence is not null on conflict (owner,month,category) do update set amount_pence=excluded.amount_pence, updated_at=now()`, [auth.me.id, body.month + "-01", JSON.stringify(budgets)]);
    const result = await db().query("select category, amount_pence::float8 as amount_pence from finance_budgets where owner=$1 and month=$2::date", [auth.me.id, body.month + "-01"]);
    return NextResponse.json({ budgets: result.rows });
  } catch (error) { return financeError(error); }
}
