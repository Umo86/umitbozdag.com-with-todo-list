"use client";

// Backstage: Umit and Dilfiraz's planner. Today, each person's own to-do
// lists (Work, Personal), the joint list, and a shared calendar. On a phone
// the sections sit in a bottom tab bar; inside the Android app it also keeps
// the phone's reminders in step and handles the back button (see native.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseTasks, ymd } from "@/lib/parse";
import Board from "./Board";
import Calendar from "./Calendar";
import Capture from "./Capture";
import Dashboard, { MicIcon } from "./Dashboard";
import EventSheet from "./EventSheet";
import Gate from "./Gate";
import Messages from "./Messages";
import NewTask from "./NewTask";
import Projects from "./Projects";
import Settings from "./Settings";
import TaskDrawer from "./TaskDrawer";
import TaskList from "./TaskList";
import { isApp, listen, prepareNotifications, syncReminders, type NotificationAction } from "./native";
import { forMe, nameOf, type ListName } from "./types";
import { useBackstage } from "./useBackstage";

type View = "today" | "mine" | "joint" | "calendar" | "messages";
type Sheet =
  | { kind: "task"; id: string }
  | { kind: "event"; id?: string; day?: string }
  | { kind: "new-task" }
  | { kind: "capture"; listen: boolean }
  | { kind: "projects" }
  | { kind: "settings" };

const LIST_KEY = "backstage:list";
const VIEW_KEY = "backstage:view";
const SEEN_KEY = "backstage:reminded";

function recall<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function remember(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window: carry on without it */
  }
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

export default function BackstageApp() {
  const bs = useBackstage();
  const { phase, me, tasks, projects, events, users } = bs;
  const narrow = useNarrow();
  const [view, setViewState] = useState<View>("today");
  const [list, setList] = useState<ListName>("work");
  const [project, setProject] = useState<string | null>(null);
  const [jointFor, setJointFor] = useState<"all" | "me" | "other">("all");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [due, setDue] = useState<string[]>([]);
  const seen = useRef<Set<string>>(new Set());

  const setView = useCallback((v: View) => {
    setViewState(v);
    remember(VIEW_KEY, v);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    setList(recall<ListName>(LIST_KEY, "work") === "personal" ? "personal" : "work");
    const v = recall<View>(VIEW_KEY, "today");
    if (["today", "mine", "joint", "calendar", "messages"].includes(v)) setViewState(v);
    seen.current = new Set(recall<string[]>(SEEN_KEY, []));
    const q = new URLSearchParams(window.location.search);
    if (q.has("capture")) setSheet({ kind: "capture", listen: false });
  }, []);

  // ——— in-page reminders (browser): check every half minute ———
  useEffect(() => {
    if (phase.kind !== "app" || !me || isApp()) return;
    const check = () => {
      const now = Date.now();
      const fresh = tasks.filter(
        (t) =>
          forMe(t.owner, t.assignee, me.id) &&
          t.remind_at &&
          t.status !== "done" &&
          new Date(t.remind_at).getTime() <= now &&
          !seen.current.has(`${t.id}|${t.remind_at}`)
      );
      if (!fresh.length) return;
      fresh.forEach((t) => {
        seen.current.add(`${t.id}|${t.remind_at}`);
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Backstage reminder", { body: t.title, tag: t.id });
          } catch {
            /* some browsers only allow this from a service worker */
          }
        }
      });
      remember(SEEN_KEY, [...seen.current].slice(-300));
      setDue((d) => [...new Set([...d, ...fresh.map((t) => t.id)])]);
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [phase.kind, tasks, me]);

  // ——— the Android app: phone reminders, notification buttons, shortcuts, back ———
  const live = useRef({ tasks, events, sheet, view, patchTask: bs.patchTask, refresh: bs.refresh });
  live.current = { tasks, events, sheet, view, patchTask: bs.patchTask, refresh: bs.refresh };

  const onNotification = useCallback((a: NotificationAction) => {
    const t = a.taskId ? live.current.tasks.find((x) => x.id === a.taskId) : undefined;
    if (a.action === "done" && t) live.current.patchTask(t.id, { status: "done" });
    else if (a.action === "snooze" && t)
      live.current.patchTask(t.id, { remind_at: new Date(Date.now() + 60 * 60_000).toISOString() });
    else if (t) setSheet({ kind: "task", id: t.id });
    else if (a.eventId && live.current.events.some((e) => e.id === a.eventId)) {
      setViewState("calendar");
      setSheet({ kind: "event", id: a.eventId });
    } else setViewState("today");
  }, []);

  useEffect(() => {
    if (phase.kind !== "app" || !isApp()) return;
    let off = () => {};
    void prepareNotifications();
    void listen({
      onNotification,
      onLink: (path) => {
        setViewState("today");
        if (path === "capture") setSheet({ kind: "capture", listen: true });
      },
      onResume: () => void live.current.refresh(),
      onBack: () => {
        if (live.current.sheet) {
          setSheet(null);
          return true;
        }
        if (live.current.view !== "today") {
          setViewState("today");
          return true;
        }
        return false;
      },
    }).then((f) => (off = f));
    return () => off();
  }, [phase.kind, onNotification]);

  useEffect(() => {
    if (phase.kind !== "app" || !isApp() || !me) return;
    const timer = setTimeout(() => void syncReminders(tasks, events, me.id).catch(() => {}), 1200);
    return () => clearTimeout(timer);
  }, [phase.kind, tasks, events, me]);

  // ——— what each view shows ———
  const mineInList = useMemo(
    () => tasks.filter((t) => me && t.owner === me.id && t.list === list),
    [tasks, me, list]
  );
  const mineShown = useMemo(
    () => (project ? mineInList.filter((t) => t.project_id === project) : mineInList),
    [mineInList, project]
  );
  const joint = useMemo(() => tasks.filter((t) => t.owner === "joint"), [tasks]);
  const jointShown = useMemo(
    () =>
      joint.filter((t) =>
        jointFor === "all"
          ? true
          : jointFor === "me"
            ? !t.assignee || t.assignee === "both" || t.assignee === me?.id
            : !t.assignee || t.assignee === "both" || (t.assignee !== me?.id)
      ),
    [joint, jointFor, me]
  );
  const myProjects = projects.filter((p) => p.owner === me?.id || p.owner === "joint");
  const openCount = (l: ListName) => tasks.filter((t) => t.owner === me?.id && t.list === l && t.status !== "done").length;
  const jointOpen = joint.filter((t) => t.status !== "done").length;
  const unread = bs.messages.filter((m) => !m.read_at).length;
  const dueTasks = due
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t && t.status !== "done");
  const other = users.find((u) => u.id !== me?.id);

  if (phase.kind !== "app" || !me) return <Gate bs={bs} />;

  const openTask = sheet?.kind === "task" ? tasks.find((t) => t.id === sheet.id) : undefined;
  const openEvent = sheet?.kind === "event" && sheet.id ? events.find((e) => e.id === sheet.id) : undefined;

  const addTyped = (text: string, owner: "mine" | "joint") => {
    const drafts = parseTasks(text, { projects, others: users.filter((u) => u.id !== me.id) });
    if (!drafts.length) return;
    void bs.addDrafts(
      drafts.map((d) => ({
        ...d,
        kind: "task" as const,
        joint: owner === "joint" || d.joint,
        assignee: owner === "joint" || d.joint ? d.assignee ?? "both" : null,
        project_id: d.project_id ?? (owner === "mine" ? project : null),
      })),
      list
    );
  };

  const NAV: Array<{ id: View; label: string; n?: number; icon: React.ReactNode }> = [
    { id: "today", label: "Today", icon: <IconToday /> },
    { id: "mine", label: "My tasks", n: openCount("work") + openCount("personal"), icon: <IconCheck /> },
    { id: "joint", label: "Joint", n: jointOpen, icon: <IconJoint /> },
    { id: "calendar", label: "Calendar", icon: <IconCal /> },
  ];

  return (
    <div className="bs-app" data-view={view}>
      <header className="bs-head">
        <div className="bs-title">
          <h1>Backstage</h1>
          <span className="today">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        <nav className="bs-tabs" aria-label="Sections">
          {NAV.map((n) => (
            <button key={n.id} aria-current={view === n.id ? "page" : undefined} onClick={() => setView(n.id)}>
              {n.label}
              {!!n.n && <span className="n">{n.n}</span>}
            </button>
          ))}
          {me.admin && (
            <button aria-current={view === "messages" ? "page" : undefined} onClick={() => setView("messages")}>
              Messages
              {unread > 0 && <span className="n new">{unread}</span>}
            </button>
          )}
        </nav>
        <div className="who">
          <button className="bs-add" onClick={() => setSheet(view === "calendar" ? { kind: "event", day: ymd(new Date()) } : { kind: "new-task" })}>
            + New
          </button>
          {me.admin && (
            <button className="bs-iconbtn bs-mail" aria-label={`Messages${unread ? `, ${unread} unread` : ""}`} onClick={() => setView("messages")}>
              <IconMail />
              {unread > 0 && <span className="badge">{unread}</span>}
            </button>
          )}
          <button className="bs-avatar-btn" onClick={() => setSheet({ kind: "settings" })} aria-label={`${me.name}: settings and sign out`}>
            <span className="bs-avatar" style={{ background: me.color }}>
              {me.name[0]}
            </span>
          </button>
        </div>
      </header>

      {dueTasks.length > 0 && (
        <div className="bs-due" role="status">
          <strong>{dueTasks.length === 1 ? "Reminder" : `${dueTasks.length} reminders`}</strong>
          <ul>
            {dueTasks.map((t) => (
              <li key={t.id}>
                <button onClick={() => setSheet({ kind: "task", id: t.id })}>{t.title}</button>
              </li>
            ))}
          </ul>
          <button className="bs-x" onClick={() => setDue([])} aria-label="Dismiss reminders">
            ×
          </button>
        </div>
      )}

      <main className="bs-main">
        {view === "today" && (
          <Dashboard
            me={me}
            tasks={tasks}
            events={events}
            projects={myProjects}
            onOpen={(id) => setSheet({ kind: "task", id })}
            onOpenEvent={(id) => setSheet({ kind: "event", id })}
            onCalendar={() => setView("calendar")}
            onPatch={bs.patchTask}
            onPickProject={(id) => {
              setProject(id);
              setView("mine");
            }}
            onManageProjects={() => setSheet({ kind: "projects" })}
            onCapture={() => setSheet({ kind: "capture", listen: true })}
          />
        )}

        {view === "mine" && (
          <>
            <div className="bs-bar">
              <div className="bs-seg" role="tablist" aria-label="List">
                {(["work", "personal"] as ListName[]).map((l) => (
                  <button
                    key={l}
                    role="tab"
                    aria-selected={list === l}
                    aria-pressed={list === l}
                    onClick={() => {
                      setList(l);
                      remember(LIST_KEY, l);
                    }}
                  >
                    {l === "work" ? "Work" : "Personal"}
                    <span className="n">{openCount(l)}</span>
                  </button>
                ))}
              </div>
              <div className="bs-filter">
                <button aria-pressed={project === null} onClick={() => setProject(null)}>
                  All
                </button>
                {myProjects.map((p) => {
                  const n = mineInList.filter((t) => t.project_id === p.id && t.status !== "done").length;
                  return (
                    <button key={p.id} aria-pressed={project === p.id} onClick={() => setProject(project === p.id ? null : p.id)}>
                      <span className="bs-dot" style={{ background: p.color }} />
                      {p.name}
                      {n > 0 && <span className="n">{n}</span>}
                    </button>
                  );
                })}
                <button className="edit" onClick={() => setSheet({ kind: "projects" })}>
                  Projects
                </button>
              </div>
            </div>
            {narrow ? (
              <TaskList
                tasks={mineShown}
                projects={projects}
                me={me.id}
                onOpen={(id) => setSheet({ kind: "task", id })}
                onPatch={bs.patchTask}
                onAdd={(t) => addTyped(t, "mine")}
                placeholder={`Add to ${list === "work" ? "Work" : "Personal"}…`}
              />
            ) : (
              <Board
                key={list}
                tasks={mineShown}
                projects={projects}
                canEdit
                onAdd={(t) => addTyped(t, "mine")}
                onPatch={bs.patchTask}
                onOpen={(id) => setSheet({ kind: "task", id })}
              />
            )}
          </>
        )}

        {view === "joint" && (
          <>
            <div className="bs-bar">
              <p className="bs-joint-note">
                <span className="bs-pair" aria-hidden="true">
                  <i style={{ background: "#1a47ff" }} />
                  <i style={{ background: "#e0457b" }} />
                </span>
                Shared with {other?.name ?? "each other"}. Blue = added by Umit, pink = added by Dilfiraz.
              </p>
              <div className="bs-seg small" role="group" aria-label="Show">
                <button aria-pressed={jointFor === "all"} onClick={() => setJointFor("all")}>
                  Everything
                </button>
                <button aria-pressed={jointFor === "me"} onClick={() => setJointFor("me")}>
                  For me
                </button>
                {other && (
                  <button aria-pressed={jointFor === "other"} onClick={() => setJointFor("other")}>
                    For {other.name}
                  </button>
                )}
              </div>
            </div>
            {narrow ? (
              <TaskList
                tasks={jointShown}
                projects={projects}
                me={me.id}
                onOpen={(id) => setSheet({ kind: "task", id })}
                onPatch={bs.patchTask}
                onAdd={(t) => addTyped(t, "joint")}
                placeholder="Add to the joint list…"
              />
            ) : (
              <Board
                key="joint"
                tasks={jointShown}
                projects={projects}
                canEdit
                onAdd={(t) => addTyped(t, "joint")}
                onPatch={bs.patchTask}
                onOpen={(id) => setSheet({ kind: "task", id })}
              />
            )}
          </>
        )}

        {view === "calendar" && (
          <Calendar
            me={me}
            users={users}
            events={events}
            tasks={tasks}
            projects={myProjects}
            onOpenEvent={(id) => setSheet({ kind: "event", id })}
            onOpenTask={(id) => setSheet({ kind: "task", id })}
            onNewEvent={(day) => setSheet({ kind: "event", day })}
          />
        )}

        {view === "messages" && me.admin && <Messages bs={bs} messages={bs.messages} />}
      </main>

      <nav className="bs-bottom" aria-label="Sections">
        {NAV.map((n) => (
          <button key={n.id} aria-current={view === n.id ? "page" : undefined} onClick={() => setView(n.id)}>
            <span className="ico">
              {n.icon}
              {!!n.n && n.id === "joint" && <span className="badge">{n.n}</span>}
            </span>
            <span className="lbl">{n.label}</span>
          </button>
        ))}
      </nav>

      {!sheet && view !== "messages" && (
        <div className="bs-fabs">
          <button
            className="bs-fab plus"
            onClick={() => setSheet(view === "calendar" ? { kind: "event", day: ymd(new Date()) } : { kind: "new-task" })}
            aria-label={view === "calendar" ? "Add an event" : "Add a task by hand"}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button className="bs-fab" onClick={() => setSheet({ kind: "capture", listen: true })} aria-label="Speak tasks or events">
            <MicIcon size={26} />
          </button>
        </div>
      )}

      {openTask && (
        <TaskDrawer
          task={openTask}
          projects={projects}
          me={me}
          users={users}
          onPatch={bs.patchTask}
          onDelete={bs.deleteTask}
          onClose={() => setSheet(null)}
          say={bs.say}
        />
      )}
      {sheet?.kind === "event" && (!sheet.id || openEvent) && !openEvent?.busy && (
        <EventSheet
          key={sheet.id ?? sheet.day}
          bs={bs}
          me={me}
          users={users}
          event={openEvent}
          day={sheet.day}
          onClose={() => setSheet(null)}
          onSwitchToTask={sheet.id ? undefined : () => setSheet({ kind: "new-task" })}
        />
      )}
      {sheet?.kind === "new-task" && (
        <NewTask
          bs={bs}
          me={me}
          users={users}
          projects={myProjects}
          defaultList={list}
          defaultProject={view === "mine" ? project : null}
          defaultOwner={view === "joint" ? "joint" : me.id}
          onClose={() => setSheet(null)}
          onSwitchToEvent={() => setSheet({ kind: "event", day: ymd(new Date()) })}
        />
      )}
      {sheet?.kind === "capture" && (
        <Capture
          bs={bs}
          me={me}
          users={users}
          projects={myProjects}
          defaultList={list}
          defaultJoint={view === "joint"}
          autoListen={sheet.listen}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "projects" && <Projects bs={bs} projects={myProjects} onClose={() => setSheet(null)} />}
      {sheet?.kind === "settings" && <Settings bs={bs} me={me} onClose={() => setSheet(null)} />}
      {bs.notice && (
        <div className="bs-toast" role="status">
          {bs.notice}
        </div>
      )}
      <span hidden>{nameOf(me.id)}</span>
    </div>
  );
}

// ——— icons (24px, stroke) ———
const S = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function IconToday() {
  return (
    <svg {...S}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...S}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 12.5l2.8 2.8L16.5 9" />
    </svg>
  );
}
function IconJoint() {
  return (
    <svg {...S}>
      <circle cx="9" cy="8.5" r="3.2" />
      <circle cx="16.5" cy="9.5" r="2.6" />
      <path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5M14.6 14.6c2.6-.4 5 .9 5.9 4.4" />
    </svg>
  );
}
function IconCal() {
  return (
    <svg {...S}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg {...S}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3.5 7l8.5 6.5L20.5 7" />
    </svg>
  );
}
