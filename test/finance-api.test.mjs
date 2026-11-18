// Runs the production route handlers against an isolated PostgreSQL engine.
// Install @electric-sql/pglite in a scratch directory and set FINANCE_TEST_PGLITE
// to its dist/index.js file. No live database or credentials are used.
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
if (!process.env.FINANCE_TEST_PGLITE) throw Error("Set FINANCE_TEST_PGLITE to the installed PGlite dist/index.js path.");
const { PGlite } = await import(pathToFileURL(process.env.FINANCE_TEST_PGLITE).href);
const sql = new PGlite();
await sql.exec("create table users(id text primary key); insert into users values ('umit'),('dilfiraz'); create table tasks(id text, title text); insert into tasks values ('original','Keep this task');");
globalThis.__financeTestDB = {
  query: async (text, values) => {
    if (values === undefined && text.includes("create table")) return (await sql.exec(text)).at(-1);
    const result = await sql.query(text, values); return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  },
  connect: async () => ({ query: (...args) => globalThis.__financeTestDB.query(...args), release: () => {} }),
};
const stub = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "@/lib/db") return { url: stub("export const db=()=>globalThis.__financeTestDB"), shortCircuit: true };
  if (specifier === "@/lib/auth") return { url: stub(`export async function requireUser(req){const id=req.headers.get('x-test-user');return ['umit','dilfiraz'].includes(id)?{ok:true,me:{id,admin:id==='umit'}}:{ok:false,res:Response.json({error:'Sign in'},{status:401})}}`), shortCircuit: true };
  if (specifier === "@/lib/backstage") return { url: stub("export const UUID=/^[a-f0-9-]{36}$/i"), shortCircuit: true };
  if (specifier === "next/server") return next("next/server.js", context);
  if (specifier.startsWith("@/")) return next(new URL(`../${specifier.slice(2)}${/\.(ts|mjs)$/.test(specifier) ? "" : ".ts"}`, import.meta.url).href, context);
  return next(specifier, context);
} });
const ledger = await import("../app/api/backstage/finance/route.ts");
const entry = await import("../app/api/backstage/finance/[id]/route.ts");
const budgets = await import("../app/api/backstage/finance/budgets/route.ts");
const setup = await import("../app/api/backstage/finance/setup/route.ts");
const req = (method, path, body, user = "umit") => new Request(`https://example.test/api/backstage${path}`, { method, headers: { "x-test-user": user, "content-type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const input = (extra = {}) => ({ kind: "expense", amount_pence: 1250, description: "Test food", category: "Groceries", occurred_on: "2026-11-18", notes: null, ...extra });
const context = id => ({ params: Promise.resolve({ id }) });
let id;

test("setup requires the signed-in administrator and only adds Finance tables", async () => {
  assert.equal((await setup.POST(req("POST", "/finance/setup", undefined, ""))).status, 401);
  assert.equal((await setup.POST(req("POST", "/finance/setup", undefined, "dilfiraz"))).status, 403);
  assert.equal((await setup.POST(req("POST", "/finance/setup"))).status, 200);
  assert.equal((await setup.POST(req("POST", "/finance/setup"))).status, 200);
  assert.deepEqual((await sql.query("select * from tasks")).rows, [{ id: "original", title: "Keep this task" }]);
  assert.equal((await sql.query("select count(*)::int as n from finance_transactions")).rows[0].n, 0);
});
test("production CRUD validates input, keeps ownership server-side and isolates months", async () => {
  assert.equal((await ledger.POST(req("POST", "/finance", input({ amount_pence: 0 })))).status, 400);
  assert.equal((await ledger.POST(req("POST", "/finance", input({ occurred_on: "2026-02-30" })))).status, 400);
  const response = await ledger.POST(req("POST", "/finance", input({ owner: "dilfiraz" })));
  assert.equal(response.status, 201); const row = await response.json(); id = row.id;
  assert.equal(row.owner, "umit"); assert.equal(row.amount_pence, 1250); assert.equal(row.occurred_on, "2026-11-18");
  const data = await (await ledger.GET(req("GET", "/finance?month=2026-11"))).json(); assert.equal(data.transactions.length, 1);
  assert.equal((await (await ledger.GET(req("GET", "/finance?month=2026-10"))).json()).transactions.length, 0);
  assert.equal((await (await ledger.GET(req("GET", "/finance?month=2026-11", undefined, "dilfiraz"))).json()).transactions.length, 0);
  for (const method of ["PATCH", "DELETE"]) assert.equal((await entry[method](req(method, `/finance/${id}`, method === "PATCH" ? input() : undefined, "dilfiraz"), context(id))).status, 404);
  const updated = await entry.PATCH(req("PATCH", `/finance/${id}`, input({ amount_pence: 1775, occurred_on: "2026-10-31" })), context(id)); assert.equal(updated.status, 200);
  assert.equal((await (await ledger.GET(req("GET", "/finance?month=2026-11"))).json()).transactions.length, 0);
  assert.equal((await (await ledger.GET(req("GET", "/finance?month=2026-10"))).json()).transactions[0].amount_pence, 1775);
});
test("production removal and Undo retain data and reject cross-user restoration", async () => {
  assert.equal((await entry.DELETE(req("DELETE", `/finance/${id}`), context(id))).status, 200);
  assert.equal((await (await ledger.GET(req("GET", "/finance?month=2026-10"))).json()).transactions.length, 0);
  assert.equal((await entry.PATCH(req("PATCH", `/finance/${id}`, { restore: true }, "dilfiraz"), context(id))).status, 404);
  assert.equal((await entry.PATCH(req("PATCH", `/finance/${id}`, { restore: true }), context(id))).status, 200);
  assert.equal((await sql.query("select count(*)::int as n from finance_transactions")).rows[0].n, 1);
});
test("production budget SQL saves atomically and preserves other people and months", async () => {
  const save = (month, list, user) => budgets.PUT(req("PUT", "/finance/budgets", { month, budgets: list }, user));
  assert.equal((await save("2026-11", [{ category: "Groceries", amount_pence: 30000 }, { category: "Transport", amount_pence: 10000 }])).status, 200);
  await save("2026-10", [{ category: "Groceries", amount_pence: 20000 }]);
  await save("2026-11", [{ category: "Groceries", amount_pence: 5000 }], "dilfiraz");
  await save("2026-11", [{ category: "Groceries", amount_pence: null }, { category: "Transport", amount_pence: 0 }]);
  const current = await (await ledger.GET(req("GET", "/finance?month=2026-11"))).json(); assert.deepEqual(current.budgets, [{ category: "Transport", amount_pence: 0 }]);
  assert.equal((await (await ledger.GET(req("GET", "/finance?month=2026-10"))).json()).budgets[0].amount_pence, 20000);
  assert.equal((await (await ledger.GET(req("GET", "/finance?month=2026-11", undefined, "dilfiraz"))).json()).budgets[0].amount_pence, 5000);
  assert.equal((await save("2026-11", [{ category: "Transport", amount_pence: 100 }, { category: "Transport", amount_pence: 200 }])).status, 400);
  assert.equal((await (await ledger.GET(req("GET", "/finance?month=2026-11"))).json()).budgets[0].amount_pence, 0);
});
after(async () => { await sql.close(); });
