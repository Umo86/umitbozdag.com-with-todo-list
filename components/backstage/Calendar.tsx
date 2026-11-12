"use client";

// The calendar: a month at a time, with the chosen day's agenda. Your own
// events, joint ones, wedding dates, to-dos with a due
// date and project deadlines. Blue is Umit, pink is Dilfiraz, gold is the wedding.
// Your own calendar is only yours: the other person sees nothing of it.
// On the Work side it is only your work entries, work to-dos and work
// project deadlines.
import { useMemo, useState } from "react";
import { ymd } from "@/lib/parse";
import { hhmm, itemsByDay, parseDay, type DayItem } from "./calendar";
import { BUSY, WEDDING, colorOf, nameOf, softOf, type CalEvent, type Me, type Person, type Project, type Space, type Task } from "./types";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type Show = { mine: boolean; joint: boolean; wedding: boolean; todos: boolean; theirs: boolean };
const ALL: Show = { mine: true, joint: true, wedding: true, todos: true, theirs: true };
const SHOW_KEY = "backstage:cal-show";

function load(): Show {
  try {
    const v = JSON.parse(localStorage.getItem(SHOW_KEY) ?? "null");
    if (v && typeof v === "object") return { ...ALL, ...v };
  } catch {
    /* fine */
  }
  return ALL;
}

export default function Calendar({
  space,
  me,
  users,
  events,
  tasks,
  projects,
  onOpenEvent,
  onOpenTask,
  onNewEvent,
}: {
  space: Space;
  me: Me;
  users: Person[];
  events: CalEvent[]; // already only this side's
  tasks: Task[];
  projects: Project[];
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onNewEvent: (day: string) => void;
}) {
  const today = ymd(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);
  const [show, setShowState] = useState<Show>(() => (typeof window === "undefined" ? ALL : load()));
  const setShow = (s: Show) => {
    setShowState(s);
    try {
      localStorage.setItem(SHOW_KEY, JSON.stringify(s));
    } catch {
      /* fine */
    }
  };

  // six weeks from the Monday on or before the 1st
  const first = new Date(cursor);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const from = ymd(days[0]);
  const to = ymd(days[41]);

  const visible = useMemo(
    () =>
      events.filter((e) =>
        space === "work" ? true : e.wedding ? show.wedding : e.owner === "joint" ? show.joint : e.owner === me.id ? show.mine : show.theirs
      ),
    [events, show, space, me.id]
  );
  const byDay = useMemo(
    () =>
      itemsByDay(
        from < selected ? from : selected,
        to > selected ? to : selected,
        visible,
        show.todos ? tasks : [],
        show.todos ? projects : []
      ),
    [from, to, selected, visible, tasks, projects, show.todos]
  );
  const other = users.find((u) => u.id !== me.id);
  const agenda = byDay.get(selected) ?? [];
  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="bs-cal">
      <div className="bs-cal-bar">
        <div className="bs-cal-nav">
          <button onClick={() => move(-1)} aria-label="Previous month">
            ‹
          </button>
          <h2>{monthLabel}</h2>
          <button onClick={() => move(1)} aria-label="Next month">
            ›
          </button>
          <button
            className="today"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              setSelected(today);
            }}
          >
            Today
          </button>
        </div>
        <div className="bs-cal-show" role="group" aria-label="Show">
          {space === "personal" && (
            <>
              <Chip on={show.mine} color={colorOf(me.id)} onClick={() => setShow({ ...show, mine: !show.mine })}>
                Mine
              </Chip>
              <Chip on={show.joint} color="linear-gradient(90deg,#1a47ff 50%,#e0457b 50%)" onClick={() => setShow({ ...show, joint: !show.joint })}>
                Joint
              </Chip>
              <Chip on={show.wedding} color={WEDDING.bright} onClick={() => setShow({ ...show, wedding: !show.wedding })}>
                Wedding
              </Chip>
              {other && events.some((e) => e.owner === other.id) && (
                <Chip on={show.theirs} color={colorOf(other.id)} onClick={() => setShow({ ...show, theirs: !show.theirs })}>
                  {other.name}&rsquo;s
                </Chip>
              )}
            </>
          )}
          <Chip on={show.todos} color="#0b0d12" onClick={() => setShow({ ...show, todos: !show.todos })}>
            To-dos
          </Chip>
        </div>
      </div>

      <div className="bs-cal-body">
        <div className="bs-month" role="grid" aria-label={monthLabel}>
          {WEEK.map((w) => (
            <div key={w} className="wd" role="columnheader">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const key = ymd(d);
            const items = byDay.get(key) ?? [];
            const out = d.getMonth() !== cursor.getMonth();
            return (
              <button
                key={key}
                role="gridcell"
                className={`day${out ? " out" : ""}${key === today ? " today" : ""}${key === selected ? " sel" : ""}`}
                aria-selected={key === selected}
                aria-label={`${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${items.length} item${items.length === 1 ? "" : "s"}`}
                onClick={() => setSelected(key)}
                onDoubleClick={() => onNewEvent(key)}
              >
                <span className="num">{d.getDate()}</span>
                <span className="chips">
                  {items.slice(0, 3).map((it) => (
                    <span key={it.key} className={`chip ${it.kind}${it.event?.busy ? " busy" : ""}`} style={tone(it)}>
                      {it.start && !it.event?.busy ? <b>{hhmm(it.start)}</b> : null}
                      {label(it)}
                    </span>
                  ))}
                  {items.length > 3 && <span className="more">+{items.length - 3}</span>}
                </span>
                <span className="dots" aria-hidden="true">
                  {items.slice(0, 4).map((it) => (
                    <i key={it.key} style={{ background: dotColor(it) }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <section className="bs-agenda" aria-label="Agenda">
          <div className="bs-agenda-head">
            <h3>{parseDay(selected).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h3>
            <button className="btn small" onClick={() => onNewEvent(selected)}>
              + Event
            </button>
          </div>
          {agenda.length ? (
            <ul>
              {agenda.map((it) => (
                <li key={it.key}>
                  <button
                    className={`bs-agenda-item ${it.kind}${it.event?.busy ? " busy" : ""}`}
                    style={{ ["--who" as string]: dotColor(it) }}
                    disabled={!!it.event?.busy || it.kind === "deadline"}
                    onClick={() => (it.event ? onOpenEvent(it.event.id) : it.task ? onOpenTask(it.task.id) : undefined)}
                  >
                    <span className="when">
                      {it.start ? (
                        <>
                          {hhmm(it.start)}
                          {it.end && <small>{hhmm(it.end)}</small>}
                        </>
                      ) : it.kind === "task" ? (
                        "To-do"
                      ) : it.kind === "deadline" ? (
                        "Deadline"
                      ) : (
                        "All day"
                      )}
                    </span>
                    <span className="what">
                      <strong>{it.event?.busy ? `${nameOf(it.event.owner)} is busy` : label(it)}</strong>
                      <span className="sub">
                        {it.event && !it.event.busy && it.event.location ? `${it.event.location} · ` : ""}
                        {it.event?.owner === "joint"
                          ? `${it.event.wedding ? "Wedding" : "Joint"}${it.event.assignee && it.event.assignee !== "both" ? ` · for ${it.event.assignee === me.id ? "you" : nameOf(it.event.assignee)}` : ""}`
                          : it.event && !it.event.busy
                            ? it.event.owner !== me.id
                              ? `${nameOf(it.event.owner)}’s calendar · shared with you`
                              : `${it.event.work ? "Work" : "Yours"}${it.event.shared ? (space === "work" ? " · shared" : ` · ${other?.name ?? "both"} can see it`) : ""}`
                            : it.task
                              ? it.task.owner === "joint"
                                ? it.task?.wedding ? "Wedding to-do" : "Joint to-do"
                                : space === "work" ? "Work to-do" : "Your to-do"
                              : ""}
                        {it.event?.repeat && !it.event.busy ? " · ↻" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bs-empty small">Nothing on this day. Double-click a day (or tap + Event) to add one.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-pressed={on} onClick={onClick}>
      <i style={{ background: color }} />
      {children}
    </button>
  );
}

const label = (it: DayItem) =>
  it.kind === "task" ? `☐ ${it.title}` : it.kind === "deadline" ? `⚑ ${it.title}` : it.event?.busy ? "Busy" : it.title;

function dotColor(it: DayItem): string {
  if (it.event?.busy) return BUSY.color;
  if (it.event?.wedding || it.task?.wedding) return WEDDING.bright;
  if (it.event) return colorOf(it.event.added_by);
  if (it.task) return colorOf(it.task.added_by);
  return "#0b0d12";
}
function tone(it: DayItem): React.CSSProperties {
  if (it.event?.busy) return { background: BUSY.soft, color: "#5b6270" };
  if (it.event?.wedding || it.task?.wedding) return { background: WEDDING.soft, color: WEDDING.color };
  if (it.event) return { background: softOf(it.event.added_by), color: colorOf(it.event.added_by) };
  return {};
}
