"use client";

// Tasks as a simple list, for phones: In progress, To do, then Done (folded).
// Each row has a coloured edge for who added it (blue Umit, pink Dilfiraz).
import { useState } from "react";
import { REPEAT_LABEL } from "@/lib/parse";
import {
  colorOf,
  fmtDay,
  fmtWhen,
  isOverdue,
  nameOf,
  type Project,
  type Task,
  type TaskPatch,
  type UserId,
} from "./types";

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
export function BinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
    </svg>
  );
}

/** The pencil and the bin on every task. */
export function TaskActions({ title, onEdit, onDelete }: { title: string; onEdit: () => void; onDelete?: () => void }) {
  const quiet = (e: React.SyntheticEvent) => e.stopPropagation(); // don't start a drag on the board
  return (
    <span className="bs-acts" onPointerDown={quiet} onKeyDown={quiet}>
      <button type="button" className="edit" onClick={onEdit} aria-label={`Edit “${title}”`} title="Edit">
        <EditIcon />
      </button>
      {onDelete && (
        <button type="button" className="del" onClick={onDelete} aria-label={`Delete “${title}”`} title="Delete">
          <BinIcon />
        </button>
      )}
    </span>
  );
}

export function TaskRow({
  task: t,
  projects,
  me,
  onOpen,
  onPatch,
  onDelete,
  hideDay,
  showList = true,
}: {
  task: Task;
  projects: Project[];
  me: UserId;
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete?: (id: string) => void;
  hideDay?: string; // don't repeat today's date on the Today screen
  showList?: boolean;
}) {
  const done = t.status === "done";
  const p = projects.find((x) => x.id === t.project_id);
  return (
    <li className={`bs-row${done ? " done" : ""}`} style={{ ["--who" as string]: colorOf(t.added_by) }}>
      <input
        type="checkbox"
        aria-label={done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
        checked={done}
        onChange={() => onPatch(t.id, { status: done ? "todo" : "done" })}
      />
      <button className="title" onClick={() => onOpen(t.id)}>
        {t.title}
      </button>
      <TaskActions title={t.title} onEdit={() => onOpen(t.id)} onDelete={onDelete ? () => onDelete(t.id) : undefined} />
      <span className="meta">
        {t.status === "doing" && <span className="doing">In progress</span>}
        {p && (
          <span className="proj">
            <span className="bs-dot" style={{ background: p.color }} />
            {p.name}
          </span>
        )}
        {t.due_date && t.due_date !== hideDay && (
          <span className={!done && isOverdue(t.due_date) ? "late" : undefined}>{fmtDay(t.due_date)}</span>
        )}
        {t.remind_at && !done && <span>⏰ {fmtWhen(t.remind_at)}</span>}
        {t.repeat && <span title={REPEAT_LABEL[t.repeat]}>↻ {t.repeat}</span>}
        {t.priority === "high" && <span className="high">High</span>}
        {t.love_note && t.added_by !== me && <span title="There's a note for you">💌</span>}
        {t.nudges > 0 && !done && <span title="Nudges">👉 {t.nudges}</span>}
        {t.owner === "joint" && t.assignee && t.assignee !== "both" && (
          <span className="who" style={{ color: colorOf(t.assignee) }}>
            For {t.assignee === me ? "you" : nameOf(t.assignee)}
          </span>
        )}
        {showList && <span className="tag">{t.owner === "joint" ? "Joint" : t.list === "work" ? "Work" : "Personal"}</span>}
      </span>
    </li>
  );
}

export default function TaskList({
  tasks,
  projects,
  me,
  onOpen,
  onPatch,
  onDelete,
  onAdd,
  placeholder,
}: {
  tasks: Task[];
  projects: Project[];
  me: UserId;
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete?: (id: string) => void;
  onAdd: (text: string) => void;
  placeholder: string;
}) {
  const [showDone, setShowDone] = useState(false);
  const sorted = [...tasks].sort((a, b) => a.position - b.position || b.created_at.localeCompare(a.created_at));
  const doing = sorted.filter((t) => t.status === "doing");
  const todo = sorted.filter((t) => t.status === "todo");
  const done = sorted
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const rows = (list: Task[]) => (
    <ul>
      {list.map((t) => (
        <TaskRow key={t.id} task={t} projects={projects} me={me} onOpen={onOpen} onPatch={onPatch} onDelete={onDelete} showList={false} />
      ))}
    </ul>
  );

  return (
    <div className="bs-tasklist">
      <form
        className="bs-quickline"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("t") as HTMLInputElement;
          const v = input.value.trim();
          if (!v) return;
          onAdd(v);
          input.value = "";
        }}
      >
        <input name="t" placeholder={placeholder} maxLength={500} aria-label="Add a task" enterKeyHint="done" />
      </form>

      {doing.length > 0 && (
        <section className="bs-group">
          <h2>
            In progress <span className="n">{doing.length}</span>
          </h2>
          {rows(doing)}
        </section>
      )}
      <section className="bs-group">
        <h2>
          To do <span className="n">{todo.length}</span>
        </h2>
        {todo.length ? rows(todo) : <p className="bs-empty small">Nothing to do here. Add one above, or tap +.</p>}
      </section>
      {done.length > 0 && (
        <section className="bs-group done">
          <button className="bs-fold" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            Done <span className="n">{done.length}</span>
            <span aria-hidden="true">{showDone ? "▴" : "▾"}</span>
          </button>
          {showDone && rows(done.slice(0, 30))}
        </section>
      )}
    </div>
  );
}
