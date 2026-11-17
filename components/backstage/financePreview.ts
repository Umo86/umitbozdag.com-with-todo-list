import { readBudgets, readTransaction, validMonth, type FinanceBudget, type FinanceTransaction } from "@/lib/finance";
const KEY = "backstage:preview:finance:v1";
type Store = { transactions: FinanceTransaction[]; budgets: Array<FinanceBudget & { owner: string; month: string }> };
const now = () => new Date().toISOString();
function seed(): Store {
  const d = new Date(), month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const transactions: FinanceTransaction[] = [];
  const budgets: Store["budgets"] = [];
  for (const owner of ["umit", "dilfiraz"]) {
    for (const [description, amount_pence, category, kind, day] of [["Monthly salary", 285000, "Salary", "income", 1], ["Rent", 95000, "Housing", "expense", 2], ["Weekly food shop", 6840, "Groceries", "expense", 4], ["Train tickets", 4250, "Transport", "expense", 6], ["Dinner with friends", 3850, "Eating out", "expense", 8], ["Electricity", 7200, "Bills", "expense", 10]] as const) {
      transactions.push({ id: crypto.randomUUID(), owner, description, amount_pence, category, kind, occurred_on: `${month}-${String(Math.min(day, d.getDate())).padStart(2, "0")}`, notes: null, deleted_at: null, created_at: now(), updated_at: now() });
    }
    for (const [category, amount_pence] of [["Housing", 95000], ["Groceries", 30000], ["Transport", 15000], ["Eating out", 12000], ["Bills", 18000]] as const) budgets.push({ owner, month, category, amount_pence });
  }
  return { transactions, budgets };
}
export function financePreviewRequest<T>(path: string, init: { method?: string; body?: unknown } | undefined, owner: string): T {
  let store: Store;
  const raw = localStorage.getItem(KEY);
  if (raw) { store = JSON.parse(raw); if (!Array.isArray(store.transactions) || !Array.isArray(store.budgets)) throw new Error("The finance preview could not load. Reset the preview to restore sample data."); }
  else { store = seed(); localStorage.setItem(KEY, JSON.stringify(store)); }
  const url = new URL(path, "https://preview.invalid"), method = init?.method ?? "GET";
  const body = (init?.body ?? {}) as Record<string, unknown>;
  const key = url.pathname.split("/")[2];
  let result: unknown;
  if (method === "GET" && !key) {
    const month = url.searchParams.get("month"); if (!validMonth(month)) throw new Error("Choose a valid month.");
    result = { transactions: store.transactions.filter(t => t.owner === owner && !t.deleted_at && t.occurred_on.startsWith(month)).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)), budgets: store.budgets.filter(b => b.owner === owner && b.month === month).map(({ category, amount_pence }) => ({ category, amount_pence })) };
  } else if (method === "PUT" && key === "budgets") {
    if (!validMonth(body.month)) throw new Error("Choose a valid month.");
    const changes = readBudgets(body.budgets);
    for (const b of changes) {
      store.budgets = store.budgets.filter(x => !(x.owner === owner && x.month === body.month && x.category === b.category));
      if (b.amount_pence !== null) store.budgets.push({ owner, month: body.month, category: b.category, amount_pence: b.amount_pence });
    }
    result = { budgets: store.budgets.filter(b => b.owner === owner && b.month === body.month).map(({ category, amount_pence }) => ({ category, amount_pence })) };
  } else if (method === "POST" && !key) {
    const t: FinanceTransaction = { ...readTransaction(body), id: crypto.randomUUID(), owner, created_at: now(), updated_at: now(), deleted_at: null };
    store.transactions.push(t); result = t;
  } else {
    const t = store.transactions.find(t => t.id === key && t.owner === owner);
    if (!t) throw new Error("Transaction not found.");
    if (method === "DELETE") { if (t.deleted_at) throw new Error("Transaction not found."); t.deleted_at = now(); result = { ok: true }; }
    else if (method === "PATCH" && body.restore === true) { t.deleted_at = null; result = t; }
    else if (method === "PATCH" && !t.deleted_at) { Object.assign(t, readTransaction(body), { updated_at: now() }); result = t; }
    else throw new Error("Transaction not found.");
  }
  if (method !== "GET") localStorage.setItem(KEY, JSON.stringify(store));
  return structuredClone(result) as T;
}
