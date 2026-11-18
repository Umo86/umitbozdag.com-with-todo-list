"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, financeCSV, formatGBP, parsePence, readTransaction, shiftMonth, summariseFinance, validMonth, type FinanceBudget, type FinanceBudgetChange, type FinanceData, type FinanceKind, type FinanceTransaction, type TransactionInput } from "@/lib/finance";
import { ymd } from "@/lib/parse";
import type { Me } from "./types";
import type { Backstage } from "./useBackstage";
import { isApp } from "./native";

const EMPTY: FinanceData = { transactions: [], budgets: [] };
const monthName = (month: string) => new Date(month + "-01T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export default function Finance({ bs, me }: { bs: Backstage; me: Me }) {
  const [month, setMonth] = useState(ymd(new Date()).slice(0, 7));
  const [data, setData] = useState<FinanceData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [category, setCategory] = useState("all");
  const [sheet, setSheet] = useState<"expense" | "income" | "budgets" | "export" | FinanceTransaction | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const sequence = useRef(0);
  const api = bs.api, say = bs.say;
  const load = useCallback(async () => {
    const request = ++sequence.current; setLoading(true); setError("");
    try { const next = await api<FinanceData>(`/finance?month=${month}`); if (request === sequence.current) { setData(next); setNeedsSetup(false); } }
    catch (e) { if (request === sequence.current) { setError((e as Error).message || "Finance couldn’t load. Try again."); setNeedsSetup((e as { code?: string }).code === "FINANCE_SETUP_REQUIRED"); } }
    finally { if (request === sequence.current) setLoading(false); }
  }, [api, month]);
  useEffect(() => { void load(); const refresh = () => { if (!document.hidden) void load(); }; window.addEventListener("focus", refresh); window.addEventListener("backstage:resume", refresh); document.addEventListener("visibilitychange", refresh); return () => { sequence.current++; window.removeEventListener("focus", refresh); window.removeEventListener("backstage:resume", refresh); document.removeEventListener("visibilitychange", refresh); }; }, [load, me.id]);
  const summary = useMemo(() => summariseFinance(data), [data]);
  const filtered = useMemo(() => data.transactions.filter(t => (kind === "all" || t.kind === kind) && (category === "all" || t.category === category) && `${t.description} ${t.notes || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [data, kind, category, search]);
  const categories = kind === "income" ? INCOME_CATEGORIES : kind === "expense" ? EXPENSE_CATEGORIES : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const spending = summary.categories.filter(c => c.spent || c.budget !== null).sort((a, b) => b.spent - a.spent);
  const moveMonth = (value: string) => { if (validMonth(value) && value !== month) { setData(EMPTY); setMonth(value); } };
  async function saveTransaction(input: TransactionInput, another = false) {
    const editing = typeof sheet === "object" && sheet !== null ? sheet : null;
    await api(editing ? `/finance/${editing.id}` : "/finance", { method: editing ? "PATCH" : "POST", body: input });
    if (!another) setSheet(null);
    if (input.occurred_on.slice(0, 7) !== month) moveMonth(input.occurred_on.slice(0, 7)); else await load();
    say(`${editing ? "Transaction updated" : "Transaction added"}${input.occurred_on.slice(0, 7) !== month ? ` to ${monthName(input.occurred_on.slice(0, 7))}` : ""}.`);
  }
  async function remove(t: FinanceTransaction) {
    if (removing) return; setRemoving(t.id);
    try {
      await api(`/finance/${t.id}`, { method: "DELETE" }); await load();
      say("Transaction removed.", "info", { label: "Undo", run: () => { void api(`/finance/${t.id}`, { method: "PATCH", body: { restore: true } }).then(() => { void load(); say("Transaction restored."); }, (e: Error) => say(e.message, "error")); } });
    } catch (e) { say((e as Error).message, "error"); }
    finally { setRemoving(null); }
  }
  function download() {
    if (isApp()) { setSheet("export"); return; }
    const url = URL.createObjectURL(new Blob(["\uFEFF" + financeCSV(data.transactions)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `personal-finance-${month}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="bs-finance" aria-label="Personal finance">
    <div className="fn-heading"><div><p className="fn-eyebrow">PERSONAL · ONLY YOU</p><h2>Your finances</h2><p className="fn-sub">Income, spending and budgets for {monthName(month)}.</p></div><div className="fn-add-actions"><button className="btn" onClick={() => setSheet("expense")} disabled={loading || !!error}>+ Expense</button><button className="btn ghost" onClick={() => setSheet("income")} disabled={loading || !!error}>+ Income</button></div></div>
    <div className="fn-period"><div className="fn-month"><button aria-label="Previous finance month" onClick={() => moveMonth(shiftMonth(month, -1))} disabled={month === "1900-01"}>‹</button><input type="month" aria-label="Finance month" value={month} min="1900-01" max="2199-12" onInput={e => moveMonth(e.currentTarget.value)} onChange={e => moveMonth(e.target.value)} /><button aria-label="Next finance month" onClick={() => moveMonth(shiftMonth(month, 1))} disabled={month === "2199-12"}>›</button></div><div className="fn-period-actions"><button className="bs-link" onClick={() => setSheet("budgets")} disabled={loading || !!error}>Monthly budgets</button><button className="bs-link" onClick={download} disabled={loading || !!error}>Export month</button></div></div>
    {bs.preview && <p className="fn-preview">Sample finances only. Try adding a transaction or changing a budget.</p>}
    {loading && <p className="fn-loading" role="status">Updating {monthName(month)}…</p>}
    {error ? <div className="fn-error" role="alert"><p>{needsSetup ? "Enable your private Finance tracker to start. This adds separate Finance tables and keeps existing records intact." : error}</p>{needsSetup && me.admin ? <button className="btn" disabled={enabling} onClick={async () => { setEnabling(true); try { await api("/finance/setup", { method: "POST" }); await load(); } catch (e) { setError((e as Error).message); } finally { setEnabling(false); } }}>{enabling ? "Enabling…" : "Enable Finance"}</button> : <button className="btn ghost" onClick={() => void load()}>Try again</button>}{needsSetup && !me.admin && <p>Umit can enable Finance once. After that, your records stay private to you.</p>}</div> : <>
      <div className="fn-summaries" aria-label={`${monthName(month)} summary`} aria-busy={loading}>
        <div><span>Income</span><strong>{loading && !data.transactions.length ? "—" : formatGBP(summary.income)}</strong><small>Money received this month</small></div>
        <div><span>Spent</span><strong>{loading && !data.transactions.length ? "—" : formatGBP(summary.expenses)}</strong><small>All recorded expenses</small></div>
        <div><span>Net this month</span><strong className={summary.net < 0 ? "fn-negative" : ""}>{loading && !data.transactions.length ? "—" : formatGBP(summary.net)}</strong><small>Income minus expenses</small></div>
        <div><span>Budget remaining</span><strong className={data.budgets.length && summary.remaining < 0 ? "fn-negative" : ""}>{data.budgets.length ? formatGBP(summary.remaining) : "Not set"}</strong><small>{data.budgets.length ? `${formatGBP(summary.budget)} allocated · all spending included` : "Set limits for your categories"}</small></div>
      </div>
      <div className="fn-layout"><section className="fn-transactions" aria-label="Transactions"><div className="fn-section-heading"><h3>Transactions</h3><span>{filtered.length} {filtered.length === 1 ? "entry" : "entries"}</span></div>
        <div className="fn-filters"><input type="search" aria-label="Search finance transactions" placeholder="Search names or notes…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Transaction type filter" value={kind} onChange={e => { setKind(e.target.value); setCategory("all"); }}><option value="all">Income & expenses</option><option value="expense">Expenses</option><option value="income">Income</option></select><select aria-label="Transaction category filter" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        {(search || kind !== "all" || category !== "all") && <button className="bs-link fn-clear" onClick={() => { setSearch(""); setKind("all"); setCategory("all"); }}>Clear finance filters</button>}
        <ul className="fn-rows">{filtered.map(t => <li key={t.id}><span className={`fn-direction ${t.kind}`} aria-hidden="true">{t.kind === "income" ? "↙" : "↗"}</span><button className="fn-open" onClick={() => setSheet(t)} aria-label={`Edit ${t.description}`}><strong>{t.description}</strong><span>{t.category} · {new Date(t.occurred_on + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{t.notes ? " · Has notes" : ""}</span></button><span className={`fn-amount ${t.kind}`}><small>{t.kind === "income" ? "Income" : "Expense"}</small><strong>{t.kind === "income" ? "+" : "−"}{formatGBP(t.amount_pence)}</strong></span><button className="fn-remove" aria-label={`Remove ${t.description}`} disabled={!!removing} onClick={() => void remove(t)}>×</button></li>)}</ul>
        {!filtered.length && !loading && <div className="fn-empty"><h4>{data.transactions.length ? "No matching transactions" : "A fresh month"}</h4><p>{data.transactions.length ? "Try a different search or category." : "Add your first income or expense to start tracking."}</p></div>}
      </section><aside className="fn-budget-panel" aria-label="Spending by category"><div className="fn-section-heading"><h3>Spending & budgets</h3><button className="bs-link" onClick={() => setSheet("budgets")}>Edit</button></div><p className="fn-sub">{monthName(month)}</p>
        {spending.length ? <ul>{spending.map(c => <li key={c.category}><div className="fn-budget-label"><strong>{c.category}</strong><span>{formatGBP(c.spent)}</span></div>{c.budget !== null ? <><div className="fn-track" role="progressbar" aria-label={`${c.category} budget used`} aria-valuemin={0} aria-valuemax={Math.max(c.budget, c.spent, 1)} aria-valuenow={c.spent} aria-valuetext={`${formatGBP(c.spent)} spent of ${formatGBP(c.budget)}`}><span className={c.spent > c.budget ? "over" : ""} style={{ width: `${c.budget === 0 ? c.spent ? 100 : 0 : Math.min(100, c.spent / c.budget * 100)}%` }} /></div><small className={c.spent > c.budget ? "fn-negative" : ""}>{c.spent > c.budget ? `${formatGBP(c.spent - c.budget)} over` : `${formatGBP(c.budget - c.spent)} left`} · {formatGBP(c.budget)} limit</small></> : <small>No budget set</small>}</li>)}</ul> : <div className="fn-empty"><p>Set a few category limits to plan your month.</p><button className="btn ghost" onClick={() => setSheet("budgets")}>Set monthly budgets</button></div>}
        <p className="fn-private">Private to your account. Finances are never shared with your partner or shown in Work.</p>
      </aside></div>
    </>}
    {sheet && sheet !== "budgets" && sheet !== "export" && <TransactionSheet key={typeof sheet === "object" ? sheet.id : sheet} transaction={typeof sheet === "object" ? sheet : undefined} initialKind={typeof sheet === "object" ? sheet.kind : sheet} month={month} onClose={() => setSheet(null)} onSave={saveTransaction} />}
    {sheet === "export" && <ExportSheet month={month} transactions={data.transactions} onClose={() => setSheet(null)} />}
    {sheet === "budgets" && <BudgetSheet month={month} budgets={data.budgets} onClose={() => setSheet(null)} onCopy={async () => (await api<FinanceData>(`/finance?month=${shiftMonth(month, -1)}`)).budgets} onSave={async changes => { await api("/finance/budgets", { method: "PUT", body: { month, budgets: changes } }); setSheet(null); await load(); say("Monthly budgets saved."); }} />}
  </section>;
}

function TransactionSheet({ transaction, initialKind, month, onClose, onSave }: { transaction?: FinanceTransaction; initialKind: FinanceKind; month: string; onClose: () => void; onSave: (input: TransactionInput, another: boolean) => Promise<void> }) {
  const [kind, setKind] = useState<FinanceKind>(transaction?.kind ?? initialKind);
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [amount, setAmount] = useState(transaction ? (transaction.amount_pence / 100).toFixed(2) : "");
  const [category, setCategory] = useState(transaction?.category ?? (initialKind === "income" ? "Salary" : "Other"));
  const [date, setDate] = useState(transaction?.occurred_on ?? (ymd(new Date()).startsWith(month) ? ymd(new Date()) : month + "-01"));
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [extras, setExtras] = useState(!!transaction);
  const [another, setAnother] = useState(false);
  const amountBox = useRef<HTMLInputElement>(null);
  const changeKind = (value: FinanceKind) => { if (kind !== value) { setKind(value); setCategory(value === "income" ? "Salary" : "Other"); } };
  return <div className="bs-scrim" onMouseDown={e => { if (!busy && e.target === e.currentTarget) onClose(); }}><form className="bs-drawer bs-sheet fn-sheet" role="dialog" aria-modal="true" aria-labelledby="fn-entry-heading" aria-busy={busy} onSubmit={async e => { e.preventDefault(); if (busy) return; setError(""); try { const input = readTransaction({ kind, description: description.trim() || category, amount_pence: parsePence(amount), category, occurred_on: date, notes }); setBusy(true); await onSave(input, !transaction && another); if (!transaction && another) { setAmount(""); setDescription(""); setNotes(""); requestAnimationFrame(() => amountBox.current?.focus()); } } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
    <div className="bs-grab" aria-hidden="true" /><div className="bs-drawer-head"><h2 id="fn-entry-heading">{transaction ? "Edit transaction" : `Add ${kind}`}</h2><button className="bs-x" type="button" aria-label="Close" disabled={busy} onClick={onClose}>×</button></div><p className="bs-form-context">Personal · Only you · GBP</p>
    <fieldset disabled={busy}><div className="bs-seg wide" role="group" aria-label="Transaction type"><button type="button" aria-pressed={kind === "expense"} onClick={() => changeKind("expense")}>Expense</button><button type="button" aria-pressed={kind === "income"} onClick={() => changeKind("income")}>Income</button></div>
    <label htmlFor="fn-amount">Amount (£)</label><input ref={amountBox} className="fn-money-input" id="fn-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required maxLength={20} autoFocus />
    <label htmlFor="fn-category">Category</label><select id="fn-category" value={category} onChange={e => setCategory(e.target.value)}>{(kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c}>{c}</option>)}</select>
    <label htmlFor="fn-description">Name (optional)</label><input id="fn-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={200} placeholder={`Leave blank to use “${category}”`} />
    <button className="fn-extra-toggle" type="button" aria-expanded={extras} onClick={() => setExtras(!extras)}>Date & notes <span>{new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} {extras ? "⌃" : "⌄"}</span></button>
    {extras && <div className="fn-extra"><label htmlFor="fn-date">Date</label><input id="fn-date" type="date" value={date} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} required min="1900-01-01" max="2199-12-31" /><label htmlFor="fn-notes">Notes (optional)</label><textarea id="fn-notes" rows={2} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="A receipt reference or anything useful" /></div>}
    {!transaction && <label className="fn-another"><input type="checkbox" checked={another} onChange={e => setAnother(e.target.checked)} />Add another after saving</label>}</fieldset>
    {error && <p className="fn-form-error" role="alert">{error}</p>}<div className="bs-drawer-foot"><button className="btn ghost" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Saving…" : transaction ? "Save changes" : `Add ${kind}`}</button></div>
  </form></div>;
}

function ExportSheet({ month, transactions, onClose }: { month: string; transactions: FinanceTransaction[]; onClose: () => void }) {
  const csv = useMemo(() => financeCSV(transactions), [transactions]);
  const [message, setMessage] = useState("");
  const text = useRef<HTMLTextAreaElement>(null);
  return <div className="bs-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="bs-drawer bs-sheet fn-sheet" role="dialog" aria-modal="true" aria-labelledby="fn-export-heading"><div className="bs-grab" aria-hidden="true"/><div className="bs-drawer-head"><h2 id="fn-export-heading">Export {monthName(month)}</h2><button className="bs-x" aria-label="Close" onClick={onClose}>×</button></div><p className="fn-sub">{transactions.length} entries · only your selected month. Copy this CSV into a spreadsheet or save it as a .csv file.</p><label htmlFor="fn-csv">CSV data</label><textarea id="fn-csv" ref={text} value={csv} readOnly rows={10}/><button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(csv); setMessage("CSV copied. Paste it into your spreadsheet."); } catch { text.current?.focus(); text.current?.select(); setMessage("CSV selected. Use Copy on your phone to copy it."); } }}>Copy CSV</button>{message && <p className="fn-sub" role="status">{message}</p>}</section></div>;
}

function BudgetSheet({ month, budgets, onClose, onSave, onCopy }: { month: string; budgets: FinanceBudget[]; onClose: () => void; onSave: (changes: FinanceBudgetChange[]) => Promise<void>; onCopy: () => Promise<FinanceBudget[]> }) {
  const fromBudgets = (list: FinanceBudget[]) => Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, list.some(b => b.category === c) ? (list.find(b => b.category === c)!.amount_pence / 100).toFixed(2) : ""]));
  const [values, setValues] = useState<Record<string, string>>(() => fromBudgets(budgets));
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [copied, setCopied] = useState(false);
  const total = Object.values(values).reduce((sum, value) => sum + (parsePence(value) || 0), 0);
  return <div className="bs-scrim" onMouseDown={e => { if (!busy && e.target === e.currentTarget) onClose(); }}><form className="bs-drawer bs-sheet fn-sheet" role="dialog" aria-modal="true" aria-labelledby="fn-budget-heading" onSubmit={async e => { e.preventDefault(); if (busy) return; setError(""); const changes = EXPENSE_CATEGORIES.map(category => ({ category, amount_pence: values[category].trim() ? parsePence(values[category]) : null })); if (changes.some(c => values[c.category].trim() && c.amount_pence === null)) { setError("Use positive amounts with no more than two decimal places, or leave a limit blank."); return; } setBusy(true); try { await onSave(changes); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
    <div className="bs-grab" aria-hidden="true" /><div className="bs-drawer-head"><h2 id="fn-budget-heading">Monthly budgets</h2><button type="button" className="bs-x" aria-label="Close" disabled={busy} onClick={onClose}>×</button></div><p className="bs-form-context">{monthName(month)} · Personal · Only you</p><p className="fn-sub">A blank limit means no budget for that category. Enter £0 if you plan not to spend.</p>
    <button type="button" className="bs-link fn-copy" disabled={busy || month === "1900-01"} onClick={async () => { setBusy(true); setError(""); try { const previous = await onCopy(); if (!previous.length) setError("No budgets were set last month. Your current draft is unchanged."); else { setValues(fromBudgets(previous)); setCopied(true); } } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Copy last month’s limits</button>
    {copied && <p className="fn-sub" role="status">Copied into this draft. Save when you’re ready.</p>}<fieldset disabled={busy} className="fn-budget-inputs">{EXPENSE_CATEGORIES.map(category => <label key={category}>{category}<span>£<input aria-label={`${category} monthly budget`} inputMode="decimal" value={values[category]} onChange={e => setValues(v => ({ ...v, [category]: e.target.value }))} placeholder="No limit" maxLength={20} /></span></label>)}</fieldset>
    <div className="fn-budget-total"><span>Total allocated</span><strong>{formatGBP(total)}</strong></div>{error && <p className="fn-form-error" role="alert">{error}</p>}<div className="bs-drawer-foot"><button type="button" className="btn ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save budgets"}</button></div>
  </form></div>;
}
