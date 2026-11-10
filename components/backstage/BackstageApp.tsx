"use client";

// Backstage: the private production office. A Today dashboard, two lists
// (Work, Personal) each a three-column board, project labels with deadlines,
// due dates, reminders, and adding tasks by voice. Inside the Android app it
// also keeps the phone's reminders in step (see native.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board";
import Capture from "./Capture";
import Dashboard, { MicIcon } from "./Dashboard";
import Gate from "./Gate";
import { parseTasks } from "@/lib/parse";
import Messages from "./Messages";
import Projects from "./Projects";
import TaskDrawer from "./TaskDrawer";
import {
  exactAlarms,
  isApp,
  listen,
  openExactAlarmSetting,
  prepareNotifications,
  syncReminders,
  type NotificationAction,
} from "./native";
import { useBackstage } from "./useBackstage";
import type { ListName } from "./types";

const LIST_KEY = "backstage:list";
type View = "today" | ListName | "messages";
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

export default function BackstageApp() {
  const bs = useBackstage();
  const { phase, me, tasks, projects } = bs;
  const [view, setView] = useState<View>("today");
  const [list, setList] = useState<ListName>("work");
  const [capture, setCapture] = useState<null | { listen: boolean }>(null);
  const [exact, setExact] = useState<"granted" | "denied" | "n/a">("n/a");
  const [project, setProject] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [due, setDue] = useState<string[]>([]);
  const [canNotify, setCanNotify] = useState<"unsupported" | "default" | "granted" | "denied">(
    "unsupported"
  );
  const seen = useRef<Set<string>>(new Set());

  const isOwner = me?.role === "owner";
  const unread = bs.messages.filter((m) => !m.read_at).length;
  const activeList: ListName = isOwner ? list : "personal";
  const inbox = view === "messages";

  useEffect(() => {
    const l = recall<ListName>(LIST_KEY, "work") === "personal" ? "personal" : "work";
    setList(l);
    const q = new URLSearchParams(window.location.search);
    if (q.get("view") === "work" || q.get("view") === "personal") setView(q.get("view") as ListName);
    if (q.has("capture")) setCapture({ listen: false });
    seen.current = new Set(recall<string[]>(SEEN_KEY, []));
    if ("Notification" in window) setCanNotify(Notification.permission);
  }, []);

  // Reminders: check every half minute for ones that have come due.
  useEffect(() => {
    if (phase.kind !== "app") return;
    const check = () => {
      const now = Date.now();
      const fresh = tasks.filter(
        (t) =>
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
  }, [phase.kind, tasks]);

  // ——— the Android app: phone reminders, notification buttons, shortcuts ———
  const live = useRef({ tasks, patchTask: bs.patchTask, refresh: bs.refresh });
  live.current = { tasks, patchTask: bs.patchTask, refresh: bs.refresh };

  const onNotification = useCallback((a: NotificationAction) => {
    const t = a.taskId ? live.current.tasks.find((x) => x.id === a.taskId) : undefined;
    if (a.action === "done" && t) {
      live.current.patchTask(t.id, { status: "done" });
    } else if (a.action === "snooze" && t) {
      live.current.patchTask(t.id, { remind_at: new Date(Date.now() + 60 * 60_000).toISOString() });
    } else if (t) {
      setOpenId(t.id);
    } else {
      setView("today");
    }
  }, []);

  useEffect(() => {
    if (phase.kind !== "app" || !isApp()) return;
    let off = () => {};
    void prepareNotifications().then(() => exactAlarms().then(setExact));
    void listen({
      onNotification,
      onLink: (path) => {
        setView("today");
        if (path === "capture") setCapture({ listen: true });
      },
      onResume: () => {
        void live.current.refresh();
        void exactAlarms().then(setExact);
      },
    }).then((f) => (off = f));
    return () => off();
  }, [phase.kind, onNotification]);

  // keep the phone's scheduled reminders in step with the board
  useEffect(() => {
    if (phase.kind !== "app" || !isApp()) return;
    const timer = setTimeout(() => void syncReminders(tasks).catch(() => {}), 1200);
    return () => clearTimeout(timer);
  }, [phase.kind, tasks]);

  const inList = useMemo(() => tasks.filter((t) => t.list === activeList), [tasks, activeList]);
  const shown = useMemo(
    () => (project ? inList.filter((t) => t.project_id === project) : inList),
    [inList, project]
  );
  const openCount = (l: ListName) =>
    tasks.filter((t) => t.list === l && t.status !== "done").length;
  const openTask = openId ? tasks.find((t) => t.id === openId) : undefined;
  const dueTasks = due
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t && t.status !== "done");

  if (phase.kind !== "app" || !me) return <Gate bs={bs} />;

  return (
    <div className="bs-app">
      <header className="bs-head">
        <div className="bs-title">
          <h1>Backstage</h1>
          <span className="today">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
        </div>
        <div className="who">
          {isOwner && (
            <button className="bs-add" onClick={() => setCapture({ listen: false })}>
              + Add tasks
            </button>
          )}
          {exact === "denied" && (
            <button onClick={() => void openExactAlarmSetting()} title="Android may delay reminders by a few minutes until this is allowed">
              Allow on-time reminders
            </button>
          )}
          {canNotify === "default" && (
            <button
              onClick={() =>
                Notification.requestPermission().then((p) => {
                  setCanNotify(p);
                  bs.say(
                    p === "granted"
                      ? "Reminder alerts are on for this browser."
                      : "Alerts stay off. Reminders will still show on this page."
                  );
                })
              }
            >
              Turn on reminder alerts
            </button>
          )}
          <button onClick={bs.signOut}>Sign out</button>
        </div>
      </header>

      {dueTasks.length > 0 && (
        <div className="bs-due" role="status">
          <strong>{dueTasks.length === 1 ? "Reminder" : `${dueTasks.length} reminders`}</strong>
          <ul>
            {dueTasks.map((t) => (
              <li key={t.id}>
                <button onClick={() => isOwner && setOpenId(t.id)}>{t.title}</button>
              </li>
            ))}
          </ul>
          <button className="bs-x" onClick={() => setDue([])} aria-label="Dismiss reminders">
            ×
          </button>
        </div>
      )}

      <div className="bs-bar">
        {isOwner ? (
          <div className="bs-tabs" role="tablist" aria-label="List">
            <button role="tab" aria-selected={view === "today"} onClick={() => setView("today")}>
              Today
            </button>
            {(["work", "personal"] as ListName[]).map((l) => (
              <button
                key={l}
                role="tab"
                aria-selected={view === l}
                onClick={() => {
                  setView(l);
                  setList(l);
                  remember(LIST_KEY, l);
                }}
              >
                {l === "work" ? "Work" : "Personal"}
                <span className="n">{openCount(l)}</span>
              </button>
            ))}
            <button role="tab" aria-selected={inbox} onClick={() => setView("messages")}>
              Messages
              {unread > 0 && <span className="n new">{unread}</span>}
            </button>
          </div>
        ) : (
          <p className="bs-helper">
            You&rsquo;re adding to Umit&rsquo;s Personal list.
          </p>
        )}

        {isOwner && (view === "work" || view === "personal") && (
          <div className="bs-filter">
            <button aria-pressed={project === null} onClick={() => setProject(null)}>
              All
            </button>
            {projects.map((p) => {
              const n = inList.filter((t) => t.project_id === p.id && t.status !== "done").length;
              return (
                <button
                  key={p.id}
                  aria-pressed={project === p.id}
                  onClick={() => setProject(project === p.id ? null : p.id)}
                >
                  <span className="bs-dot" style={{ background: p.color }} />
                  {p.name}
                  {n > 0 && <span className="n">{n}</span>}
                </button>
              );
            })}
            <button className="edit" onClick={() => setManaging(true)}>
              Edit projects
            </button>
          </div>
        )}
      </div>

      {inbox && isOwner ? (
        <Messages bs={bs} messages={bs.messages} />
      ) : view === "today" && isOwner ? (
        <Dashboard
          tasks={tasks}
          projects={projects}
          onOpen={setOpenId}
          onPatch={bs.patchTask}
          onPickProject={(id) => {
            setProject(id);
            setView(list);
          }}
          onManageProjects={() => setManaging(true)}
          onCapture={() => setCapture({ listen: true })}
        />
      ) : (
        <Board
          key={activeList}
          tasks={shown}
          projects={projects}
          canEdit={isOwner}
          onAdd={(title) => {
            // typed straight into a column: dates, reminders etc. are read too
            const drafts = parseTasks(title, { projects });
            if (!drafts.length) return;
            void bs.addDrafts(
              drafts.map((d) => ({ ...d, project_id: d.project_id ?? project })),
              activeList
            );
          }}
          onPatch={bs.patchTask}
          onOpen={setOpenId}
        />
      )}

      {openTask && isOwner && (
        <TaskDrawer
          task={openTask}
          projects={projects}
          onPatch={bs.patchTask}
          onDelete={bs.deleteTask}
          onClose={() => setOpenId(null)}
          say={bs.say}
        />
      )}
      {managing && <Projects bs={bs} projects={projects} onClose={() => setManaging(false)} />}
      {capture && isOwner && (
        <Capture
          bs={bs}
          projects={projects}
          defaultList={view === "personal" ? "personal" : "work"}
          autoListen={capture.listen}
          onClose={() => setCapture(null)}
        />
      )}
      {isOwner && !capture && !openTask && !managing && (
        <button className="bs-fab" onClick={() => setCapture({ listen: true })} aria-label="Speak tasks">
          <MicIcon size={26} />
        </button>
      )}
      {bs.notice && (
        <div className="bs-toast" role="status">
          {bs.notice}
        </div>
      )}
    </div>
  );
}
