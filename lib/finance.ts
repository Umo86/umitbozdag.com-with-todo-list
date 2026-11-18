// Shared validation and calculations. Amounts are integer pence throughout.
export const EXPENSE_CATEGORIES = ["Housing", "Groceries", "Transport", "Eating out", "Bills", "Shopping", "Health", "Entertainment", "Travel", "Other"] as const;
export const INCOME_CATEGORIES = ["Salary", "Freelance", "Gifts", "Refunds", "Other income"] as const;
export const MAX_PENCE = 10_000_000_000;
export type FinanceKind = "income" | "expense";
export type TransactionInput = { kind: FinanceKind; amount_pence: number; description: string; category: string; occurred_on: string; notes: string | null };
export type FinanceTransaction = TransactionInput & { id: string; owner: string; created_at: string; updated_at: string; deleted_at: string | null };
export type FinanceBudget = { category: string; amount_pence: number };
export type FinanceBudgetChange = { category: string; amount_pence: number | null };
export type FinanceData = { transactions: FinanceTransaction[]; budgets: FinanceBudget[] };

export function validMonth(value: unknown): value is string { return typeof value === "string" && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value); }
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T12:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function shiftMonth(month: string, offset: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
export function parsePence(value: string): number | null {
  let clean = value.trim().replace(/^£\s*/, "");
  if (/^\.\d{1,2}$/.test(clean)) clean = "0" + clean;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.replace(/,/g, "").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= MAX_PENCE ? amount : null;
}
export const formatGBP = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
export function readTransaction(body: Record<string, unknown>): TransactionInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Enter the transaction details.");
  if (body.kind !== "income" && body.kind !== "expense") throw new Error("Choose income or expense.");
  if (!Number.isSafeInteger(body.amount_pence) || Number(body.amount_pence) <= 0 || Number(body.amount_pence) > MAX_PENCE) throw new Error("Enter an amount greater than zero, with no more than two decimal places.");
  if (typeof body.description !== "string" || !body.description.trim() || body.description.trim().length > 200) throw new Error("Give the transaction a name (up to 200 characters).");
  if (!validDate(body.occurred_on)) throw new Error("Choose a valid transaction date.");
  const categories: readonly string[] = body.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (typeof body.category !== "string" || !categories.includes(body.category)) throw new Error("Choose a category for this transaction.");
  if (body.notes != null && (typeof body.notes !== "string" || body.notes.length > 2000)) throw new Error("Notes can contain up to 2,000 characters.");
  return { kind: body.kind, amount_pence: Number(body.amount_pence), description: body.description.trim(), category: body.category, occurred_on: body.occurred_on, notes: typeof body.notes === "string" ? body.notes.trim() || null : null };
}
export function readBudgets(value: unknown): FinanceBudgetChange[] {
  if (!Array.isArray(value) || value.length > EXPENSE_CATEGORIES.length) throw new Error("Choose a monthly limit for each expense category.");
  const seen = new Set<string>();
  return value.map(row => {
    if (!row || !EXPENSE_CATEGORIES.includes(row.category) || seen.has(row.category)) throw new Error("Each expense category can have one budget.");
    if (row.amount_pence !== null && (!Number.isSafeInteger(row.amount_pence) || row.amount_pence < 0 || row.amount_pence > MAX_PENCE)) throw new Error("Budget amounts must be zero or more, with no more than two decimal places.");
    seen.add(row.category); return { category: String(row.category), amount_pence: row.amount_pence === null ? null : Number(row.amount_pence) };
  });
}
export function summariseFinance(data: FinanceData) {
  const income = data.transactions.filter(t => !t.deleted_at && t.kind === "income").reduce((sum, t) => sum + t.amount_pence, 0);
  const expenses = data.transactions.filter(t => !t.deleted_at && t.kind === "expense").reduce((sum, t) => sum + t.amount_pence, 0);
  const budget = data.budgets.reduce((sum, b) => sum + b.amount_pence, 0);
  const categories = EXPENSE_CATEGORIES.map(category => ({ category, spent: data.transactions.filter(t => !t.deleted_at && t.kind === "expense" && t.category === category).reduce((sum, t) => sum + t.amount_pence, 0), budget: data.budgets.find(b => b.category === category)?.amount_pence ?? null }));
  return { income, expenses, net: income - expenses, budget, remaining: budget - expenses, categories };
}
export function financeCSV(transactions: FinanceTransaction[]) {
  const cell = (value: unknown) => { let text = String(value ?? ""); if (/^[\s\t\r]*[=+@-]/.test(text)) text = "'" + text; return `"${text.replace(/"/g, '""')}"`; };
  return ["Date,Type,Description,Category,Amount (GBP),Notes", ...transactions.filter(t => !t.deleted_at).map(t => [t.occurred_on, t.kind, t.description, t.category, (t.amount_pence / 100).toFixed(2), t.notes || ""].map(cell).join(","))].join("\r\n");
}
