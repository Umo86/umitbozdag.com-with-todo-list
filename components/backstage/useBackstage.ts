"use client";

// Everything Backstage needs from the outside world: the signed-in person,
// the /api/backstage calls, and the data (tasks, projects, events) with
// optimistic updates.
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Assignee,
  ChatMessage,
  Score,
  UsItem,
  UsKind,
  CalEvent,
  EventPatch,
  ListName,
  Me,
  Message,
  Owner,
  Person,
  Priority,
  Project,
  Repeat,
  Task,
  TaskPatch,
} from "./types";
import { localToIso, ymd, type Draft } from "@/lib/parse";

export type NewTask = {
  title: string;
  list: ListName;
  owner?: Owner;
  assignee?: Assignee | null;
  project_id?: string | null;
  notes?: string | null;
  priority?: Priority;
  due_date?: string | null;
  remind_at?: string | null;
  repeat?: Repeat | null;
};

export type Phase =
  | { kind: "loading" }
  | { kind: "noconfig"; missing: string }
  | { kind: "signin"; reason?: string }
  | { kind: "locked"; message: string }
  | { kind: "app" };

class ApiError extends Error {
  status: number;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.error ?? "Something went wrong."));
    this.status = status;
  }
}

export function useBackstage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<Person[]>([]);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error"; action?: { label: string; run: () => void } } | null>(null);
  const [online, setOnline] = useState(true);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [us, setUs] = useState<UsItem[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [birthdays, setBirthdays] = useState<Record<string, string | null>>({});
  const [chatUnread, setChatUnread] = useState(0);
  const [seenUpTo, setSeenUpTo] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const [pushKey, setPushKey] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string, tone: "info" | "error" = "info", action?: { label: string; run: () => void }) => {
    setNotice({ text: msg, tone, action });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), tone === "error" || action ? 6500 : 3200);
  }, []);

  // The session is an HttpOnly cookie, sent automatically to this site.
  const api = useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      let res: Response;
      try {
        res = await fetch(`/api/backstage${path}`, {
        method: init?.method ?? "GET",
        credentials: "same-origin",
        headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      } catch {
        // no answer at all: offline, or the server is unreachable
        throw new ApiError(0, {
          error: typeof navigator !== "undefined" && !navigator.onLine
            ? "You're offline. This didn't save. Try again when you're back online."
            : "Can't reach Backstage right now. Check your connection and try again.",
        });
      }
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        if (res.status >= 500 && !data.error) data.error = "Something went wrong on the server. Try again in a moment.";
        if (res.status === 429 && !data.error) data.error = "Too many tries. Wait a little and try again.";
        throw new ApiError(res.status, data);
      }
      return data as T;
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const data = await api<{
        me: Me;
        users: Person[];
        projects: Project[];
        tasks: Task[];
        events: CalEvent[];
        messages?: Message[];
        chat_unread?: number;
        us?: UsItem[];
        scores?: Score[];
        birthdays?: Record<string, string | null>;
      }>("/state");
      setUs(data.us ?? []);
      setScores(data.scores ?? []);
      setBirthdays(data.birthdays ?? {});
      setChatUnread(data.chat_unread ?? 0);
      setProjects(data.projects ?? []);
      setTasks(data.tasks ?? []);
      setEvents(data.events ?? []);
      setMessages(data.messages ?? []);
      setUsers(data.users ?? []);
      setMe(data.me);
      setPhase({ kind: "app" });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401)
        setPhase((prev) => ({ kind: "signin", reason: prev.kind === "app" ? "You were signed out (your session ended or your password changed). Sign in again." : undefined }));
      else if (err.status === 503 && /password/i.test(err.message)) setPhase({ kind: "noconfig", missing: "BACKSTAGE_PASSWORD" });
      else {
        // already on the board: keep it and say so; otherwise explain on the gate
        setPhase((prev) =>
          prev.kind === "app"
            ? prev
            : { kind: "locked", message: `Backstage couldn't load. ${err.message}` }
        );
        say(err.message, "error");
      }
    }
  }, [api, say]);

  // boot: check the server is set up, then see whether a session already exists
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = (await (await fetch("/api/backstage/config")).json()) as {
          password?: string;
          database?: string;
          ai?: string;
          push_key?: string;
        };
        if (cancelled) return;
        setAi(cfg.ai === "on");
        setPushKey(cfg.push_key ?? "");
        if (cfg.password !== "ok") return setPhase({ kind: "noconfig", missing: "BACKSTAGE_PASSWORD" });
        if (cfg.database === "missing") return setPhase({ kind: "noconfig", missing: "DATABASE_URL" });
        if (cfg.database !== "ok") {
          return setPhase({
            kind: "locked",
            message:
              "Backstage can't reach its database right now, so nothing would save. Try again in a minute.",
          });
        }
        await refresh();
      } catch {
        if (!cancelled)
          setPhase({ kind: "locked", message: "Backstage couldn't load. Check your connection and reload." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // returns an error message, or "" on success
  const signIn = useCallback(
    async (username: string, password: string): Promise<string> => {
      try {
        await api("/login", { method: "POST", body: { username, password } });
        await refresh();
        return "";
      } catch (e) {
        return (e as Error).message || "That didn't work. Try again.";
      }
    },
    [api, refresh]
  );

  const signOut = useCallback(() => {
    const done = () => {
      setTasks([]);
      setEvents([]);
      setMessages([]);
      setProjects([]);
      setMe(null);
      setPhase({ kind: "signin" });
    };
    api("/logout", { method: "POST", body: {} }).then(done, done);
  }, [api]);

  // ——— board actions (optimistic; the server's answer replaces the guess) ———
  const fail = useCallback(
    (e: unknown) => {
      const err = e as ApiError;
      if (err.status !== 401) say(err.message || "That didn't save. Try again.", "error");
      void refresh();
    },
    [say, refresh]
  );

  const addTask = useCallback(
    async (body: NewTask) => {
      try {
        const t = await api<Task>("/tasks", { method: "POST", body });
        setTasks((prev) => [t, ...prev]);
        return t;
      } catch (e) {
        fail(e);
        return null;
      }
    },
    [api, fail]
  );

  // Several drafts at once (from speech). Returns how many were saved.
  const addDrafts = useCallback(
    async (drafts: Draft[], fallbackList: ListName): Promise<number> => {
      let saved = 0;
      const made: Task[] = [];
      const evs: CalEvent[] = [];
      for (const d of drafts) {
        try {
          if (d.kind === "event") {
            const day = d.due_date ?? ymd(new Date());
            const e = await api<CalEvent>("/events", {
              method: "POST",
              body: {
                title: d.title,
                owner: d.joint ? "joint" : me?.id,
                assignee: d.joint ? d.assignee ?? "both" : null,
                all_day: !d.start_local,
                start_date: d.start_local ? undefined : day,
                starts_at: d.start_local ? localToIso(d.start_local) : undefined,
                ends_at: d.start_local
                  ? new Date(new Date(d.start_local).getTime() + 60 * 60_000).toISOString()
                  : undefined,
                remind_minutes: d.remind_minutes,
                repeat: d.repeat,
              },
            });
            evs.push(e);
            saved++;
            continue;
          }
          const t = await api<Task>("/tasks", {
            method: "POST",
            body: {
              title: d.title,
              owner: d.joint ? "joint" : me?.id,
              assignee: d.joint ? d.assignee ?? "both" : null,
              list: d.list ?? fallbackList,
              project_id: d.project_id,
              priority: d.priority,
              due_date: d.due_date,
              remind_at: localToIso(d.remind_local),
              repeat: d.repeat,
            },
          });
          made.push(t);
          saved++;
        } catch (e) {
          say((e as Error).message);
        }
      }
      if (made.length) setTasks((prev) => [...made.reverse(), ...prev]);
      if (evs.length) setEvents((prev) => [...prev, ...evs]);
      return saved;
    },
    [api, say, me]
  );

  // ——— online / offline ———
  useEffect(() => {
    const on = () => {
      setOnline(true);
      void refresh();
    };
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  // ——— chat ———
  const chatRef = useRef<ChatMessage[]>([]);
  chatRef.current = chat;
  /** Fetch all (first time) or only new messages. Returns the new ones from the other person. */
  const pollChat = useCallback(
    async (full = false): Promise<ChatMessage[]> => {
      const last = chatRef.current[chatRef.current.length - 1];
      const r = await api<{ messages: ChatMessage[]; unread: number; seen_up_to: string | null }>(
        full || !last ? "/chat" : `/chat?after=${encodeURIComponent(last.created_at)}`
      );
      setChatUnread(r.unread);
      setSeenUpTo(r.seen_up_to);
      if (full || !last) {
        setChat(r.messages);
        return [];
      }
      const known = new Set(chatRef.current.map((m) => m.id));
      const fresh = r.messages.filter((m) => !known.has(m.id));
      if (fresh.length) setChat((prev) => [...prev, ...fresh]);
      return fresh.filter((m) => m.sender !== me?.id);
    },
    [api, me]
  );
  const pollChatRef = useRef<((full?: boolean) => Promise<ChatMessage[]>) | null>(null);
  pollChatRef.current = pollChat;
  const sendChat = useCallback(
    async (body: string, kind: "text" | "heart" = "text"): Promise<boolean> => {
      if (!me) return false;
      const temp: ChatMessage = {
        id: `temp-${Date.now()}`,
        sender: me.id,
        body,
        kind,
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
      };
      setChat((prev) => [...prev, temp]);
      try {
        const m = await api<ChatMessage>("/chat", { method: "POST", body: { body, kind } });
        setChat((prev) => prev.map((x) => (x.id === temp.id ? m : x)));
        return true;
      } catch (e) {
        setChat((prev) => prev.map((x) => (x.id === temp.id ? { ...x, pending: false, failed: true } : x)));
        say((e as Error).message, "error");
        return false;
      }
    },
    [api, me, say]
  );
  const dropChat = useCallback((id: string) => setChat((prev) => prev.filter((m) => m.id !== id)), []);
  const deleteChat = useCallback(
    (id: string) => {
      setChat((prev) => prev.filter((m) => m.id !== id));
      api(`/chat/${id}`, { method: "DELETE" }).catch((e: Error) => say(e.message, "error"));
    },
    [api, say]
  );
  const markChatRead = useCallback(async () => {
    setChatUnread(0);
    await api("/chat/read", { method: "POST", body: {} }).catch(() => {});
  }, [api]);

  // ——— the fun bits ———
  const addUs = useCallback(
    async (body: Partial<UsItem> & { kind: UsKind }) => {
      try {
        const item = await api<UsItem>("/us", { method: "POST", body });
        setUs((prev) => [
          item,
          ...prev.filter(
            (x) =>
              !(
                (item.kind === "mood" && x.kind === "mood" && x.added_by === item.added_by && x.day === item.day) ||
                (item.kind === "vote" && x.kind === "vote" && x.added_by === item.added_by && x.ref === item.ref)
              )
          ),
        ]);
        return item;
      } catch (e) {
        say((e as Error).message, "error");
        return null;
      }
    },
    [api, say]
  );
  const patchUs = useCallback(
    (id: string, patch: Partial<UsItem>) => {
      setUs((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      api<UsItem>(`/us/${id}`, { method: "PATCH", body: patch }).then(
        (item) => setUs((prev) => prev.map((x) => (x.id === id ? item : x))),
        fail
      );
    },
    [api, fail]
  );
  const deleteUs = useCallback(
    (id: string) => {
      setUs((prev) => prev.filter((x) => x.id !== id && x.ref !== id));
      api(`/us/${id}`, { method: "DELETE" }).catch(fail);
    },
    [api, fail]
  );
  const clearUs = useCallback(
    async (what: "my-votes" | "ticked-shopping") => {
      setUs((prev) =>
        prev.filter((x) =>
          what === "my-votes" ? !(x.kind === "vote" && x.added_by === me?.id) : !(x.kind === "shopping" && x.done)
        )
      );
      await api(`/us?what=${what}`, { method: "DELETE" }).catch(fail);
    },
    [api, fail, me]
  );
  const nudge = useCallback(
    async (taskId: string) => {
      try {
        const r = await api<{ nudges: number }>(`/tasks/${taskId}/nudge`, { method: "POST", body: {} });
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, nudges: r.nudges } : t)));
        say(r.nudges > 2 ? `Nudged (${r.nudges} times now 😅)` : "Nudged 👉");
        void pollChatRef.current?.(false);
      } catch (e) {
        say((e as Error).message, "error");
      }
    },
    [api, say]
  );
  const setBirthday = useCallback(
    async (birthday: string | null) => {
      try {
        await api("/me", { method: "PATCH", body: { birthday } });
        if (me) setBirthdays((b) => ({ ...b, [me.id]: birthday }));
        say("Birthday saved 🎂");
      } catch (e) {
        say((e as Error).message, "error");
      }
    },
    [api, say, me]
  );

  // ——— calendar ———
  const addEvent = useCallback(
    async (body: EventPatch & { title: string }) => {
      try {
        const e = await api<CalEvent>("/events", { method: "POST", body });
        setEvents((prev) => [...prev, e]);
        return e;
      } catch (e) {
        say((e as Error).message);
        return null;
      }
    },
    [api, say]
  );
  const patchEvent = useCallback(
    async (id: string, patch: EventPatch) => {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      try {
        const e = await api<CalEvent>(`/events/${id}`, { method: "PATCH", body: patch });
        setEvents((prev) => prev.map((x) => (x.id === id ? e : x)));
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [api, fail]
  );
  const deleteEvent = useCallback(
    (id: string) => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      api(`/events/${id}`, { method: "DELETE" }).catch(fail);
    },
    [api, fail]
  );

  const patchTask = useCallback(
    (id: string, patch: TaskPatch) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      api<Task & { spawned?: Task }>(`/tasks/${id}`, { method: "PATCH", body: patch }).then(({ spawned, ...t }) => {
        setTasks((prev) => {
          const next = prev.map((x) => (x.id === id ? (t as Task) : x));
          return spawned && !next.some((x) => x.id === spawned.id) ? [spawned, ...next] : next;
        });
        if (spawned?.due_date) {
          say(`Next one added for ${new Date(spawned.due_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}.`);
        }
      }, fail);
    },
    [api, fail, say]
  );

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      api(`/tasks/${id}`, { method: "DELETE" }).catch(fail);
    },
    [api, fail]
  );

  const addProject = useCallback(
    async (name: string, color: string, due_date: string | null = null, owner: Owner | null = null) => {
      try {
        const p = await api<Project>("/projects", { method: "POST", body: { name, color, due_date, owner: owner ?? undefined } });
        setProjects((prev) => [...prev, p]);
      } catch (e) {
        fail(e);
      }
    },
    [api, fail]
  );

  const patchProject = useCallback(
    (id: string, patch: { name?: string; color?: string; due_date?: string | null; owner?: Owner }) => {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      api(`/projects/${id}`, { method: "PATCH", body: patch }).catch(fail);
    },
    [api, fail]
  );

  const deleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTasks((prev) => prev.map((t) => (t.project_id === id ? { ...t, project_id: null } : t)));
      api(`/projects/${id}`, { method: "DELETE" }).catch(fail);
    },
    [api, fail]
  );

  const patchMessage = useCallback(
    (id: string, read: boolean) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, read_at: read ? new Date().toISOString() : null } : m))
      );
      api(`/messages/${id}`, { method: "PATCH", body: { read } }).catch(fail);
    },
    [api, fail]
  );

  const deleteMessage = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      api(`/messages/${id}`, { method: "DELETE" }).catch(fail);
    },
    [api, fail]
  );

  return {
    phase,
    setPhase,
    me,
    projects,
    tasks,
    events,
    users,
    messages,
    addEvent,
    patchEvent,
    deleteEvent,
    notice,
    online,
    chat,
    chatUnread,
    seenUpTo,
    pollChat,
    sendChat,
    dropChat,
    deleteChat,
    us,
    scores,
    birthdays,
    addUs,
    patchUs,
    deleteUs,
    clearUs,
    nudge,
    setBirthday,
    markChatRead,
    say,
    ai,
    pushKey,
    api,
    refresh,
    addDrafts,
    signIn,
    signOut,
    addTask,
    patchTask,
    deleteTask,
    addProject,
    patchProject,
    deleteProject,
    patchMessage,
    deleteMessage,
  };
}

export type Backstage = ReturnType<typeof useBackstage>;
