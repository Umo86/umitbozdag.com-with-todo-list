"use client";

// Today: one screen that answers "what needs me?" on the side you are on.
// Work: work tasks, the work calendar and work projects, nothing else.
// Personal: your personal and joint things, plus the two-of-you extras.
// What's late, what's due today and this week, the next reminders, and how
// each project stands against its deadline.
import { useMemo } from "react";
import { ymd } from "@/lib/parse";
import { hhmm, itemsByDay } from "./calendar";
import { TaskRow } from "./TaskList";
import { BirthdayNote, Countdowns, MemoryOfTheDay, MoodBar, Scoreboard } from "./Fun";
import type { Backstage } from "./useBackstage";
import type { Person, Space } from "./types";
import { colorOf, fmtDay, fmtWhen, nameOf, type CalEvent, type Me, type Project, type Task, type TaskPatch } from "./types";

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
  space,
  me,
  tasks,
  events,
  projects,
  onOpen,
  onOpenEvent,
  onCalendar,
  onPatch,
  onDelete,
  onPickProject,
  onManageProjects,
  bs,
  users,
  onUs,
  top,
  side,
}: {
  space: Space;
  me: Me;
  tasks: Task[]; // already only this side's
  events: CalEvent[];
  projects: Project[];
  onOpen: (id: string) => void;
  onOpenEvent: (id: string) => void;
  onCalendar: () => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  onPickProject: (id: string) => void;
  onManageProjects: () => void;
  bs: Backstage;
  users: Person[];
  onUs: (section: "gifts" | "memories") => void;
  top?: React.ReactNode; // a card that needs attention now (a video waiting to be watched)
  side?: React.ReactNode; // extra cards for the side column (send a video)
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

  const tomorrow = ymd(new Date(Date.now() + DAY));
  const schedule = itemsByDay(today, tomorrow, events.filter((e) => !e.busy), [], []);
  const todayEvents = schedule.get(today) ?? [];
  const tomorrowEvents = schedule.get(tomorrow) ?? [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const personal = space === "personal";
  const nothing = !overdue.length && !dueToday.length && !week.length && !urgentUndated.length;

  return (
    <div className="bs-dash">
      <p className="bs-hello">
        {greeting}, <span style={{ color: me.color }}>{me.name}</span>
        <span className={`bs-sidetag ${space}`}>{personal ? "Personal" : "Work"}</span>
        <span className="bs-hello-date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
      </p>
      <div className="bs-stats">
        <Stat n={overdue.length} label="Overdue" tone={overdue.length ? "bad" : undefined} />
        <Stat n={dueToday.length} label="Due today" tone={dueToday.length ? "accent" : undefined} />
        <Stat n={week.length} label="Next 7 days" />
        <Stat n={doneToday} label="Done today" tone={doneToday ? "good" : undefined} />
        <Stat n={todayEvents.length} label="Events today" extra />
        <Stat n={soon} label="Reminders in 24h" extra />
      </div>

      {personal && <MoodBar bs={bs} me={me} users={users} />}
      {top}
      {personal && <BirthdayNote bs={bs} me={me} users={users} onGifts={() => onUs("gifts")} />}

      <div className="bs-dash-grid">
        <section className="bs-dash-main" aria-label="Due">
          <section className="bs-schedule" aria-labelledby="h-sched">
            <div className="bs-side-head">
              <h2 id="h-sched">Today&rsquo;s plan</h2>
              <button className="bs-link" onClick={onCalendar}>
                Calendar
              </button>
            </div>
            {todayEvents.length ? (
              <ul>
                {todayEvents.map((it) => (
                  <li key={it.key}>
                    <button onClick={() => onOpenEvent(it.event!.id)} style={{ ["--who" as string]: colorOf(it.event!.added_by) }}>
                      <time>{it.start ? hhmm(it.start) : "All day"}</time>
                      <span>
                        <strong>{it.title}</strong>
                        {(it.event!.location || it.event!.owner !== me.id || it.event!.shared) && (
                          <small>
                            {[
                              it.event!.location,
                              it.event!.owner === "joint" ? "Joint" : it.event!.owner !== me.id ? `${nameOf(it.event!.owner)}’s` : it.event!.shared ? "Shared" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet small">Nothing in your {personal ? "" : "work "}calendar today.</p>
            )}
            {tomorrowEvents.length > 0 && (
              <p className="bs-tomorrow quiet small">
                Tomorrow:{" "}
                {tomorrowEvents
                  .slice(0, 3)
                  .map((it) => (it.start ? `${hhmm(it.start)} ${it.title}` : it.title))
                  .join(" · ")}
                {tomorrowEvents.length > 3 ? ` +${tomorrowEvents.length - 3}` : ""}
              </p>
            )}
          </section>

          {nothing && (
            <p className="bs-empty">
              Nothing due this week{personal ? "" : " at work"}. Anything with a date or a reminder shows up here.
            </p>
          )}
          <Group title="Overdue" tone="bad" items={overdue} {...{ projects, onOpen, onPatch, onDelete, today, me: me.id }} />
          <Group title="Today" items={dueToday} {...{ projects, onOpen, onPatch, onDelete, today, me: me.id }} />
          <Group title="Next 7 days" items={week} {...{ projects, onOpen, onPatch, onDelete, today, me: me.id }} />
          <Group title="Urgent, no date" items={urgentUndated} {...{ projects, onOpen, onPatch, onDelete, today, me: me.id }} />
        </section>

        <aside className="bs-dash-side">
          {side}
          {personal && (
            <>
              <Countdowns bs={bs} />
              <Scoreboard scores={bs.scores} users={users} me={me} />
              <MemoryOfTheDay bs={bs} onOpen={() => onUs("memories")} />
            </>
          )}
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
              <p className="quiet small">No reminders set. Add one when you create or edit a task.</p>
            )}
          </section>

          <section aria-labelledby="h-proj">
            <div className="bs-side-head">
              <h2 id="h-proj">{personal ? "Personal projects" : "Work projects"}</h2>
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
                <li className="quiet small">No {personal ? "personal" : "work"} projects yet.</li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ n, label, tone, extra }: { n: number; label: string; tone?: "bad" | "accent" | "good"; extra?: boolean }) {
  return (
    <div className={`bs-stat${tone ? ` ${tone}` : ""}${extra ? " extra" : ""}`}>
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
  onDelete,
  today,
  me,
}: {
  title: string;
  items: Task[];
  tone?: "bad";
  projects: Project[];
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  today: string;
  me: Me["id"];
}) {
  if (!items.length) return null;
  return (
    <section className={`bs-group${tone ? ` ${tone}` : ""}`}>
      <h2>
        {title} <span className="n">{items.length}</span>
      </h2>
      <ul>
        {items.map((t) => (
          <TaskRow key={t.id} task={t} projects={projects} me={me} onOpen={onOpen} onPatch={onPatch} onDelete={onDelete} hideDay={today} />
        ))}
      </ul>
    </section>
  );
}
