"use client";

// Backstage: the private production office. Two lists (Personal, Work), each
// a three-column board, with project labels, due dates and reminders.
import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board";
import Gate from "./Gate";
import Messages from "./Messages";
import Projects from "./Projects";
import TaskDrawer from "./TaskDrawer";
import { useBackstage } from "./useBackstage";
import type { ListName } from "./types";

const LIST_KEY = "backstage:list";
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
  const [list, setList] = useState<ListName>("work");
  const [project, setProject] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [due, setDue] = useState<string[]>([]);
  const [canNotify, setCanNotify] = useState<"unsupported" | "default" | "granted" | "denied">(
    "unsupported"
  );
  const seen = useRef<Set<string>>(new Set());

  const isOwner = me?.role === "owner";
  const unread = bs.messages.filter((m) => !m.read_at).length;
  const activeList: ListName = isOwner ? list : "personal";

  useEffect(() => {
    setList(recall<ListName>(LIST_KEY, "work") === "personal" ? "personal" : "work");
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
            {(["work", "personal"] as ListName[]).map((l) => (
              <button
                key={l}
                role="tab"
                aria-selected={!inbox && list === l}
                onClick={() => {
                  setInbox(false);
                  setList(l);
                  remember(LIST_KEY, l);
                }}
              >
                {l === "work" ? "Work" : "Personal"}
                <span className="n">{openCount(l)}</span>
              </button>
            ))}
            <button role="tab" aria-selected={inbox} onClick={() => setInbox(true)}>
              Messages
              {unread > 0 && <span className="n new">{unread}</span>}
            </button>
          </div>
        ) : (
          <p className="bs-helper">
            You&rsquo;re adding to Umit&rsquo;s Personal list.
          </p>
        )}

        {isOwner && !inbox && (
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
      ) : (
        <Board
          key={activeList}
          tasks={shown}
          projects={projects}
          canEdit={isOwner}
          onAdd={(title) =>
            void bs.addTask({ title, list: activeList, project_id: project })
          }
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
      {bs.notice && (
        <div className="bs-toast" role="status">
          {bs.notice}
        </div>
      )}
    </div>
  );
}
