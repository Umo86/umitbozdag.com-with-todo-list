"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseTask, REPEAT_LABEL, REPEATS, ymd, type Draft, type Repeat } from "@/lib/parse";
import { fmtDay, type Person, type Priority, type Project } from "./types";

export default function QuickCapture({ context, storageKey, projects, users, defaultProject, onAdd, onDetails }: {
  context: string; storageKey: string; projects: Project[]; users: Person[];
  defaultProject?: string | null; onAdd: (draft: Draft) => Promise<boolean>; onDetails: (draft: Draft | null, title: string) => void;
}) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [batch, setBatch] = useState(false);
  const [more, setMore] = useState(false);
  const [due, setDue] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(defaultProject ?? null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [repeat, setRepeat] = useState<Repeat | "" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved.text === "string") {
        setText(saved.text); setBatch(!!saved.batch);
        setDue(saved.due ?? null); setProject(saved.project ?? defaultProject ?? null);
        setPriority(saved.priority ?? null); setRepeat(saved.repeat ?? null);
      }
    } catch { /* storage is optional */ }
    setLoaded(true);
  }, [storageKey, defaultProject]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ text, batch, due, project, priority, repeat })); } catch { /* still usable without storage */ }
  }, [text, batch, due, project, priority, repeat, loaded, storageKey]);

  const drafts = useMemo(() => (batch ? text.split(/\r?\n/) : [text]).map(line => ({ line, draft: parseTask(line, { projects, others: users }) })).filter((x): x is { line: string; draft: Draft } => !!x.draft).map(({ line, draft }) => ({ line, draft: { ...draft, ...(due !== null ? { due_date: due || null } : {}), ...(project !== null ? { project_id: project || null } : {}), ...(priority !== null ? { priority } : {}), ...(repeat !== null ? { repeat: repeat || null } : {}) } })), [text, batch, projects, users, due, project, priority, repeat]);
  const first = drafts[0]?.draft;
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };
  const parsed = !!first && (first.title !== text.trim() || first.due_date || first.repeat || first.project_id || first.remind_local || first.priority === "high");

  async function submit() {
    if (busy || !drafts.length) return;
    setBusy(true); setError(""); setNotice("");
    const failed: string[] = [];
    for (const item of drafts) {
      try { if (!(await onAdd(item.draft))) failed.push(item.line); }
      catch { failed.push(item.line); }
    }
    const added = drafts.length - failed.length;
    if (failed.length) { setText(failed.join(batch ? "\n" : "")); setError("Some tasks couldn’t save. Your unsaved text is still here; try again."); }
    else { setText(""); setDue(null); setProject(defaultProject ?? null); setPriority(null); setRepeat(null); setMore(false); }
    if (added) setNotice(`${added === 1 ? "Task" : `${added} tasks`} added to ${context}.`);
    setBusy(false); input.current?.focus();
  }

  return (
    <section className={`bs-capture${batch ? " batch" : ""}`} aria-label={`Add to ${context}`}>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <div className="bs-capture-context"><span>Add to {context}</span><button type="button" disabled={busy || (batch && text.includes("\n"))} aria-pressed={batch} onClick={() => { setBatch(!batch); input.current?.focus(); }}>{batch ? "One task" : "Add several"}</button></div>
        <div className="bs-capture-entry">
          <textarea ref={input} value={text} onChange={e => { setText(e.target.value); setError(""); setNotice(""); }} placeholder={batch ? "One task per line…" : "What needs doing?"} aria-label={batch ? "Tasks, one per line" : "New task"} rows={batch ? 4 : 1} maxLength={batch ? 10000 : 500} disabled={busy} enterKeyHint={batch ? "enter" : "done"} onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey && (!batch || e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
          }} />
          <button className="btn bs-capture-submit" disabled={busy || !drafts.length}>{busy ? "Adding…" : batch ? `Add ${drafts.length || ""} tasks` : "Add task"}</button>
        </div>
        <div className="bs-capture-tools">
          <button type="button" aria-pressed={due === ymd(new Date())} onClick={() => setDue(due === ymd(new Date()) ? null : ymd(new Date()))}>Today</button>
          <button type="button" aria-pressed={due === tomorrow()} onClick={() => setDue(due === tomorrow() ? null : tomorrow())}>Tomorrow</button>
          <button type="button" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Fewer options" : "Date & project"}</button>
          {!batch && <button type="button" className="bs-capture-details" onClick={() => { const base = first ?? parseTask("New task", { projects, others: users }); onDetails(base ? { ...base, title: first?.title ?? "", due_date: due !== null ? due || null : base.due_date, project_id: project !== null ? project || null : base.project_id, priority: priority ?? base.priority, repeat: repeat !== null ? repeat || null : base.repeat } : null, text); }}>All details ↗</button>}
        </div>
        {more && <div className="bs-capture-options">
          <label>Due date<input type="date" value={due ?? first?.due_date ?? ""} onChange={e => setDue(e.target.value)} /></label>
          <label>Project<select value={project ?? first?.project_id ?? ""} onChange={e => setProject(e.target.value)}><option value="">No project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Priority<select value={priority ?? first?.priority ?? "normal"} onChange={e => setPriority(e.target.value as Priority)}><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label>
          <label>Repeat<select value={repeat ?? first?.repeat ?? ""} onChange={e => setRepeat(e.target.value as Repeat | "")}><option value="">Doesn’t repeat</option>{REPEATS.map(r => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}</select></label>
        </div>}
        {batch && drafts.length > 0 ? <ol className="bs-capture-review" aria-label="Task preview">{drafts.map(({ draft }, i) => <li key={i}><span>{draft.title}</span><small>{draft.due_date ? fmtDay(draft.due_date) : "No date"}{draft.project_id ? ` · ${projects.find(p => p.id === draft.project_id)?.name || "Project"}` : ""}</small></li>)}</ol> : parsed && first ? <div className="bs-capture-parsed" aria-live="polite"><span>{first.title}</span>{first.due_date && <span>Due {fmtDay(first.due_date)}</span>}{first.project_id && <span>{projects.find(p => p.id === first.project_id)?.name}</span>}{first.repeat && <span>{REPEAT_LABEL[first.repeat]}</span>}{first.remind_local && <span>Reminder {first.remind_local.replace("T", " ")}</span>}{first.priority === "high" && <span>High priority</span>}</div> : <p className="bs-capture-hint">Try “Chase the signage quote tomorrow”. Enter to add.</p>}
        {error && <p className="error-line" role="alert">{error}</p>}
        {notice && <p className="bs-capture-success" role="status">{notice}</p>}
      </form>
    </section>
  );
}
