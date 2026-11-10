"use client";

// Today: one screen that answers "what needs me?" across both lists:
// what's late, what's due today and this week, the next reminders, and how
// each project stands against its deadline.
import { useMemo } from "react";
import { REPEAT_LABEL, ymd } from "@/lib/parse";
import { fmtDay, fmtWhen, type Project, type Task, type TaskPatch } from "./types";

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / DAY);

function countdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${-days} days ago`;
  if (days < 14) return `in ${days} days`;
  if (days < 70) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30.4)} months`;
}

const byUrgency = (a: Task, b: Task) =>
  (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
  (a.priority === "high" ? -1 : 0) - (b.priority === "high" ? -1 : 0) ||
  (a.remind_at ?? "").localeCompare(b.remind_at ?? "");

export default function Dashboard({
  tasks,
  projects,
  onOpen,
  onPatch,
  onPickProject,
  onManageProjects,
  onCapture,
}: {
  tasks: Task[];
  projects: Project[];
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  onPickProject: (id: string) => void;
  onManageProjects: () => void;
  onCapture: () => void;
}) {
  const today = ymd(new Date());
  const in7 = ymd(new Date(Date.now() + 7 * DAY));
  const open = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const overdue = open.filter((t) => t.due_date && t.due_date < today).sort(byUrgency);
  const dueToday = open.filter((t) => t.due_date === today).sort(byUrgency);
  const week = open.filter((t) => t.due_date && t.due_date > today && t.due_date <= in7).sort(byUrgency);
  const urgentUndated = open.filter((t) => !t.due_date && t.priority === "high");
  const now = Date.now();
  const reminders = open
    .filter((t) => t.remind_at && new Date(t.remind_at).getTime() > now - 60 * 60_000)
    .sort((a, b) => a.remind_at!.localeCompare(b.remind_at!))
    .slice(0, 6);
  const soon = reminders.filter((t) => new Date(t.remind_at!).getTime() < now + DAY).length;
  const doneToday = tasks.filter((t) => t.status === "done" && t.completed_at && ymd(new Date(t.completed_at)) === today).length;

  const projectCards = projects
    .map((p) => {
      const mine = tasks.filter((t) => t.project_id === p.id);
      const left = mine.filter((t) => t.status !== "done");
      const next = [...left].sort(byUrgency)[0];
      return { p, total: mine.length, left: left.length, done: mine.length - left.length, next };
    })
    .sort(
      (a, b) =>
        (a.p.due_date ?? "9999").localeCompare(b.p.due_date ?? "9999") || b.left - a.left
    );

  const nothing = !overdue.length && !dueToday.length && !week.length && !urgentUndated.length;

  return (
    <div className="bs-dash">
      <div className="bs-stats">
        <Stat n={overdue.length} label="Overdue" tone={overdue.length ? "bad" : undefined} />
        <Stat n={dueToday.length} label="Due today" tone={dueToday.length ? "accent" : undefined} />
        <Stat n={week.length} label="Next 7 days" />
        <Stat n={soon} label="Reminders in 24h" />
        <Stat n={doneToday} label="Done today" tone={doneToday ? "good" : undefined} />
      </div>

      <div className="bs-dash-grid">
        <section className="bs-dash-main" aria-label="Due">
          <button className="bs-capture-cta" onClick={onCapture}>
            <span className="mic" aria-hidden="true">
              <MicIcon />
            </span>
            <span>
              <strong>Speak or type your to-dos</strong>
              <span className="quiet">
                &ldquo;Call the venue tomorrow at 10 and chase the signage quote, remind me Friday&rdquo;
              </span>
            </span>
          </button>

          {nothing && (
            <p className="bs-empty">
              Nothing due this week. Anything with a date or a reminder shows up here.
            </p>
          )}
          <Group title="Overdue" tone="bad" items={overdue} {...{ projects, onOpen, onPatch, today }} />
          <Group title="Today" items={dueToday} {...{ projects, onOpen, onPatch, today }} />
          <Group title="Next 7 days" items={week} {...{ projects, onOpen, onPatch, today }} />
          <Group title="Urgent, no date" items={urgentUndated} {...{ projects, onOpen, onPatch, today }} />
        </section>

        <aside className="bs-dash-side">
          <section aria-labelledby="h-rem">
            <h2 id="h-rem">Coming up</h2>
            {reminders.length ? (
              <ul className="bs-rem">
                {reminders.map((t) => (
                  <li key={t.id}>
                    <time>{fmtWhen(t.remind_at!)}</time>
                    <button onClick={() => onOpen(t.id)}>{t.title}</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet small">No reminders set. Say &ldquo;remind me…&rdquo; when you add a task.</p>
            )}
          </section>

          <section aria-labelledby="h-proj">
            <div className="bs-side-head">
              <h2 id="h-proj">Projects</h2>
              <button className="bs-link" onClick={onManageProjects}>
                Add or edit
              </button>
            </div>
            <ul className="bs-projcards">
              {projectCards.map(({ p, total, left, done, next }) => {
                const days = p.due_date ? daysBetween(today, p.due_date) : null;
                return (
                  <li key={p.id}>
                    <button onClick={() => onPickProject(p.id)} style={{ ["--pc" as string]: p.color }}>
                      <span className="name">
                        <span className="bs-dot" style={{ background: p.color }} />
                        {p.name}
                      </span>
                      {p.due_date ? (
                        <span className={`deadline${days !== null && days < 0 ? " late" : days !== null && days <= 14 ? " near" : ""}`}>
                          {fmtDay(p.due_date)} · {countdown(days!)}
                        </span>
                      ) : (
                        <span className="deadline quiet">No deadline</span>
                      )}
                      <span className="bar" aria-hidden="true">
                        <span style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
                      </span>
                      <span className="counts">
                        {left} open · {done} done
                      </span>
                      {next && (
                        <span className="next">
                          Next: {next.title}
                          {next.due_date ? ` · ${fmtDay(next.due_date)}` : ""}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {!projectCards.length && (
                <li className="quiet small">No projects yet.</li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "bad" | "accent" | "good" }) {
  return (
    <div className={`bs-stat${tone ? ` ${tone}` : ""}`}>
      <strong>{n}</strong>
      <span>{label}</span>
    </div>
  );
}

function Group({
  title,
  items,
  tone,
  projects,
  onOpen,
  onPatch,
  today,
}: {
  title: string;
  items: Task[];
  tone?: "bad";
  projects: Project[];
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  today: string;
}) {
  if (!items.length) return null;
  return (
    <section className={`bs-group${tone ? ` ${tone}` : ""}`}>
      <h2>
        {title} <span className="n">{items.length}</span>
      </h2>
      <ul>
        {items.map((t) => {
          const p = projects.find((x) => x.id === t.project_id);
          return (
            <li key={t.id} className="bs-row">
              <input
                type="checkbox"
                aria-label={`Mark "${t.title}" done`}
                checked={false}
                onChange={() => onPatch(t.id, { status: "done" })}
              />
              <button className="title" onClick={() => onOpen(t.id)}>
                {t.title}
              </button>
              <span className="meta">
                {p && (
                  <span className="proj">
                    <span className="bs-dot" style={{ background: p.color }} />
                    {p.name}
                  </span>
                )}
                {t.due_date && t.due_date !== today && (
                  <span className={t.due_date < today ? "late" : undefined}>{fmtDay(t.due_date)}</span>
                )}
                {t.remind_at && <span>⏰ {fmtWhen(t.remind_at)}</span>}
                {t.repeat && <span title={REPEAT_LABEL[t.repeat]}>↻ {t.repeat}</span>}
                {t.priority === "high" && <span className="high">High</span>}
                <span className="tag">{t.list === "work" ? "Work" : "Personal"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MicIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}
