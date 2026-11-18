import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { EXPENSE_CATEGORIES, financeCSV, parsePence, readBudgets, readTransaction, shiftMonth, summariseFinance, validDate, validMonth } from "../lib/finance.ts";
import { FINANCE_SCHEMA } from "../scripts/finance-schema.mjs";
registerHooks({ resolve(specifier, context, next) { if (specifier.startsWith("@/")) return next(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context); return next(specifier, context); } });
const memory = new Map();
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k), get length() { return memory.size; }, key: i => [...memory.keys()][i] ?? null };
const { financePreviewRequest: request } = await import("../components/backstage/financePreview.ts");
const transaction = (extra = {}) => ({ kind: "expense", amount_pence: 1234, description: "Food shop", category: "Groceries", occurred_on: "2026-08-17", notes: null, ...extra });
const api = (path, method = "GET", body, user = "umit") => request(path, { method, body }, user);

test("money is parsed to integer pence without rounding or exponent notation", () => {
  assert.equal(parsePence("0.10") + parsePence("0.20"), 30);
  assert.equal(parsePence(".50"), 50); assert.equal(parsePence(".5"), 50); assert.equal(parsePence("."), null);
  assert.equal(parsePence("£1,234.50"), 123450); assert.equal(parsePence("12.3"), 1230); assert.equal(parsePence("0"), 0);
  for (const invalid of ["1.234", "1e3", "-5", "NaN", "", "12,34", "Infinity", "100000001"]) assert.equal(parsePence(invalid), null, invalid);
});
test("dates and month navigation handle leap years and year boundaries", () => {
  assert.ok(validDate("2024-02-29")); assert.ok(!validDate("2026-02-29")); assert.ok(!validDate("2026-13-01"));
  assert.ok(validMonth("2026-11")); assert.ok(!validMonth("2026-00")); assert.equal(shiftMonth("2026-12", 1), "2027-01"); assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
test("transaction validation rejects unsafe amounts and mismatched categories", () => {
  assert.equal(readTransaction(transaction({ description: " Food shop " })).description, "Food shop");
  for (const amount_pence of [0, -1, 1.5, Number.MAX_SAFE_INTEGER, null]) assert.throws(() => readTransaction(transaction({ amount_pence })));
  assert.throws(() => readTransaction(transaction({ kind: "income", category: "Groceries" })));
  assert.throws(() => readTransaction(transaction({ occurred_on: "2026-02-30" })));
  assert.throws(() => readTransaction(null));
});
test("budgets distinguish no limit from an explicit zero limit", () => {
  assert.deepEqual(readBudgets([{ category: "Housing", amount_pence: 0 }, { category: "Groceries", amount_pence: null }]), [{ category: "Housing", amount_pence: 0 }, { category: "Groceries", amount_pence: null }]);
  assert.throws(() => readBudgets([{ category: "Housing", amount_pence: 1 }, { category: "Housing", amount_pence: 2 }]));
  assert.throws(() => readBudgets([{ category: "Salary", amount_pence: 500 }]));
});
test("monthly totals exclude deleted transactions and report overspending", () => {
  const summary = summariseFinance({ transactions: [transaction({ kind: "income", category: "Salary", amount_pence: 10000 }), transaction({ amount_pence: 3000 }), transaction({ amount_pence: 2000, deleted_at: "2026-08-18" })], budgets: [{ category: "Groceries", amount_pence: 2500 }] });
  assert.equal(summary.income, 10000); assert.equal(summary.expenses, 3000); assert.equal(summary.net, 7000); assert.equal(summary.remaining, -500); assert.equal(summary.categories.find(c => c.category === "Groceries").spent, 3000);
});
test("CSV safely quotes notes and protects spreadsheet formula cells", () => {
  const csv = financeCSV([transaction({ description: '=HYPERLINK("bad")', notes: 'A "quoted", note\nnext line' })]);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"')); assert.ok(csv.includes('"A ""quoted"", note\nnext line"')); assert.ok(csv.includes('"12.34"'));
});
test("preview CRUD is private, month scoped, and supports delete undo", () => {
  memory.clear();
  const t = api("/finance", "POST", transaction());
  assert.ok(api("/finance?month=2026-08").transactions.some(x => x.id === t.id));
  assert.ok(!api("/finance?month=2026-09").transactions.some(x => x.id === t.id));
  assert.ok(!api("/finance?month=2026-08", "GET", undefined, "dilfiraz").transactions.some(x => x.id === t.id));
  assert.throws(() => api(`/finance/${t.id}`, "DELETE", undefined, "dilfiraz"));
  api(`/finance/${t.id}`, "PATCH", transaction({ amount_pence: 2000 }));
  assert.equal(api("/finance?month=2026-08").transactions.find(x => x.id === t.id).amount_pence, 2000);
  api(`/finance/${t.id}`, "DELETE"); assert.ok(!api("/finance?month=2026-08").transactions.some(x => x.id === t.id));
  api(`/finance/${t.id}`, "PATCH", { restore: true }); assert.ok(api("/finance?month=2026-08").transactions.some(x => x.id === t.id));
});
test("budgets for another month or user remain unchanged", () => {
  memory.clear();
  api("/finance/budgets", "PUT", { month: "2026-08", budgets: [{ category: "Groceries", amount_pence: 30000 }] });
  api("/finance/budgets", "PUT", { month: "2026-09", budgets: [{ category: "Groceries", amount_pence: 50000 }] });
  api("/finance/budgets", "PUT", { month: "2026-08", budgets: [{ category: "Groceries", amount_pence: 10000 }] }, "dilfiraz");
  api("/finance/budgets", "PUT", { month: "2026-08", budgets: [{ category: "Groceries", amount_pence: null }] });
  assert.equal(api("/finance?month=2026-08").budgets.length, 0);
  assert.equal(api("/finance?month=2026-09").budgets[0].amount_pence, 50000);
  assert.equal(api("/finance?month=2026-08", "GET", undefined, "dilfiraz").budgets[0].amount_pence, 10000);
});
test("preview persistence fails visibly instead of discarding a transaction", () => {
  const original = localStorage.setItem; localStorage.setItem = () => { throw new Error("Storage full"); };
  try { assert.throws(() => api("/finance", "POST", transaction()), /Storage full/); } finally { localStorage.setItem = original; }
});
test("finance schema only adds separate tables and indexes, without data seeding", () => {
  assert.ok(!/\b(drop|truncate|alter|delete|update|insert)\b/i.test(FINANCE_SCHEMA));
  assert.deepEqual([...FINANCE_SCHEMA.matchAll(/create table if not exists (\w+)/g)].map(m => m[1]), ["finance_transactions", "finance_budgets"]);
  assert.ok(EXPENSE_CATEGORIES.length > 0);
});
