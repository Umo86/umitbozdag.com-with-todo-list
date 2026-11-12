"use client";

// Everything Backstage needs from the outside world: the signed-in person,
// the /api/backstage calls, and the data (tasks, projects, events) with
// optimistic updates.
import { useCallback, useEffect, useRef, useState } from "react";
import { countFiles, FILE_MAX_MB, NO_WEDDING, setAreas, type TaskFile, type Wedding } from "./types";
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
  wedding?: boolean;
  area_id?: string | null;
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
  const tasksNow = useRef<Task[]>([]);
  tasksNow.current = tasks;
  // deleted a moment ago: really removed once the Undo message has gone
  const deleting = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  countFiles(files); // rows and cards read the paperclip count from this
  const [wedding, setWedding] = useState<Wedding>(NO_WEDDING);
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
  const [pushKey, setPushKey] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string, tone: "info" | "error" = "info", action?: { label: string; run: () => void }) => {
    setNotice({ text: msg, tone, action });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), tone === "error" || action ? 6500 : 3200);
  }, []);

  // The session is an HttpOnly cookie, sent automatically to this site.
  // saves on their way to the server: live updates wait for these, so a
  // change you just made is never briefly undone by an older answer
  const saving = useRef(0);
  const isSaving = useCallback(() => saving.current > 0, []);
  const api = useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      const write = !!init?.method && init.method !== "GET";
      if (write) saving.current++;
      try {
        return await send<T>(path, init);
      } finally {
        if (write) saving.current--;
      }
    },
    []
  );
  const send = useCallback(
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

  /** Load everything again. Hands back the tasks it loaded (null if it couldn't). */
  const refresh = useCallback(async (): Promise<Task[] | null> => {
    try {
      const data = await api<{
        me: Me;
        users: Person[];
        projects: Project[];
        tasks: Task[];
        events: CalEvent[];
        files?: TaskFile[];
        wedding?: Wedding;
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
      setTasks((data.tasks ?? []).filter((t) => !deleting.current.has(t.id)));
      setEvents(data.events ?? []);
      setFiles(data.files ?? []);
      if (data.wedding) {
        setAreas(data.wedding.areas);
        setWedding({ ...data.wedding, guests: data.wedding.guests ?? [] });
      }
      setMessages(data.messages ?? []);
      setUsers(data.users ?? []);
      setMe(data.me);
      setPhase({ kind: "app" });
      return data.tasks ?? [];
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
      return null;
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
          push_key?: string;
        };
        if (cancelled) return;
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

  // Save drafts read from typed text. Returns how many were saved.
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
                work: !d.joint && fallbackList === "work",
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
              owner: d.joint || d.wedding ? "joint" : me?.id,
              assignee: d.wedding ? d.assignee : d.joint ? d.assignee ?? "both" : null,
              wedding: !!d.wedding,
              area_id: d.wedding ? d.area_id ?? null : null,
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

  // ——— files on tasks ———
  /**
   * Attach a file to a task. It goes up in pieces (each retried a few times),
   * so a big PDF or a weak signal is fine. `onPct` hears the progress.
   * Hands back the stored file, or null if it didn't work (the reason is shown).
   */
  const uploadFile = useCallback(
    async (taskId: string, file: File, onPct?: (pct: number) => void): Promise<TaskFile | null> => {
      if (file.size > FILE_MAX_MB * 1048576) {
        say(`${file.name} is ${Math.round(file.size / 1048576)} MB. The limit is ${FILE_MAX_MB} MB a file.`, "error");
        return null;
      }
      if (!file.size) {
        say(`${file.name} is empty.`, "error");
        return null;
      }
      try {
        const start = await send<{ id: string; chunk: number }>(`/tasks/${taskId}/files`, {
          method: "POST",
          body: { name: file.name, mime: file.type, size: file.size },
        });
        const total = Math.ceil(file.size / start.chunk);
        for (let i = 0; i < total; i++) {
          const part = file.slice(i * start.chunk, (i + 1) * start.chunk);
          for (let attempt = 1; ; attempt++) {
            const res = await fetch(`/api/backstage/files/${start.id}/chunk?i=${i}`, {
              method: "PUT",
              credentials: "same-origin",
              headers: { "Content-Type": "application/octet-stream" },
              body: part,
            }).catch(() => null);
            if (res?.ok) break;
            if (attempt >= 4 || (res && res.status < 500)) {
              const d = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
              throw new Error(d.error || `${file.name} didn't upload. Check your connection and try again.`);
            }
            await new Promise((r) => setTimeout(r, 1200 * attempt));
          }
          onPct?.(Math.round(((i + 1) / total) * 100));
        }
        const f = await send<TaskFile>(`/files/${start.id}/done`, { method: "POST" });
        setFiles((prev) => [...prev.filter((x) => x.id !== f.id), f]);
        return f;
      } catch (e) {
        say((e as Error).message || `${file.name} didn't upload. Try again.`, "error");
        return null;
      }
    },
    [send, say]
  );
  const deleteFile = useCallback(
    (id: string) => {
      const before = files;
      setFiles((prev) => prev.filter((f) => f.id !== id));
      api(`/files/${id}`, { method: "DELETE" }).catch((e) => {
        setFiles(before);
        say((e as Error).message, "error");
      });
    },
    [api, say, files]
  );
  /** A short-lived link to one file, for the phone's own browser (the app can't save files itself). */
  const fileLink = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        return (await send<{ url: string }>(`/files/${id}/link`, { method: "POST" })).url;
      } catch (e) {
        say((e as Error).message, "error");
        return null;
      }
    },
    [send, say]
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
  // A new message or heart from the other person is announced exactly once,
  // whoever fetched it (the regular check, opening the chat, a nudge) and
  // whichever screen is open. A marker on this device remembers how far the
  // announcing has got, so a heart sent while Backstage was closed still shows
  // on the next open, and nothing is announced twice.
  // The handler may answer false ("not now": the Work side is showing). Then
  // the marker stays put and the same messages are offered again later.
  const incomingHandler = useRef<((fresh: ChatMessage[]) => boolean | void) | null>(null);
  const onIncoming = useCallback((fn: ((fresh: ChatMessage[]) => boolean | void) | null) => {
    incomingHandler.current = fn;
  }, []);
  const chatMark = useRef<number | null>(null);
  const announce = useCallback(
    (messages: ChatMessage[]) => {
      if (!me) return;
      const store = `backstage:chat-mark:${me.id}`;
      if (chatMark.current === null) {
        try {
          chatMark.current = Number(localStorage.getItem(store)) || 0;
        } catch {
          chatMark.current = 0;
        }
      }
      const mark = chatMark.current;
      const at = (m: ChatMessage) => new Date(m.created_at).getTime();
      const theirs = messages.filter((m) => m.sender !== me.id && !m.pending);
      // first time on this device: only what's unread and recent, not the whole history
      const fresh = theirs.filter((m) => at(m) > mark && (mark > 0 || (!m.read_at && Date.now() - at(m) < 12 * 3_600_000)));
      const newest = theirs.reduce((a, m) => Math.max(a, at(m)), mark);
      if (fresh.length && incomingHandler.current?.(fresh) === false) return;
      if (newest > mark) {
        chatMark.current = newest;
        try {
          localStorage.setItem(store, String(newest));
        } catch {
          /* private mode: the ref still stops repeats */
        }
      }
    },
    [me]
  );
  const pollChat = useCallback(
    async (full = false): Promise<ChatMessage[]> => {
      const last = chatRef.current[chatRef.current.length - 1];
      const r = await api<{ messages: ChatMessage[]; unread: number; seen_up_to: string | null }>(
        full || !last ? "/chat" : `/chat?after=${encodeURIComponent(last.created_at)}`
      );
      setChatUnread(r.unread);
      setSeenUpTo(r.seen_up_to);
      announce(r.messages);
      if (full || !last) {
        setChat(r.messages);
        return [];
      }
      const known = new Set(chatRef.current.map((m) => m.id));
      const fresh = r.messages.filter((m) => !known.has(m.id));
      if (fresh.length) setChat((prev) => [...prev, ...fresh]);
      return fresh.filter((m) => m.sender !== me?.id);
    },
    [api, me, announce]
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
                (item.kind === "vote" && x.kind === "vote" && x.added_by === item.added_by && x.ref === item.ref && x.title === item.title)
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
  // Wedding planning: every change comes back as the whole plan and its areas.
  const weddingCall = useCallback(
    async (path: string, method: string, body?: unknown): Promise<boolean> => {
      try {
        const w = await api<Wedding | { added: number }>(`/wedding${path}`, { method, body: body ?? {} });
        if ("plan" in w) {
          setAreas(w.areas);
          setWedding({ ...w, guests: w.guests ?? [] });
        }
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [api, fail]
  );
  // Start one swipe game again: clears your own votes in it (not the other game's).
  const clearVotes = useCallback(
    async (game: "dinner" | "date") => {
      const prefix = game === "dinner" ? "dish:" : "date:";
      setUs((prev) => {
        const ideas = new Set(prev.filter((x) => x.kind === "idea" && x.list === game).map((x) => x.id));
        return prev.filter(
          (x) => !(x.kind === "vote" && x.added_by === me?.id && (x.ref ? ideas.has(x.ref) : x.title.startsWith(prefix)))
        );
      });
      await api(`/us?what=my-votes&game=${game}`, { method: "DELETE" }).catch(fail);
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

  // Deleting takes the task off the screen at once and shows "Undo" for a
  // few seconds; only then is it removed for good.
  const deleteTask = useCallback(
    (id: string) => {
      const index = tasksNow.current.findIndex((t) => t.id === id);
      const gone = tasksNow.current[index];
      if (!gone) return;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      const really = () => {
        deleting.current.delete(id);
        api(`/tasks/${id}`, { method: "DELETE" }).catch(fail);
      };
      deleting.current.set(id, setTimeout(really, 6500));
      say("Task deleted.", "info", {
        label: "Undo",
        run: () => {
          const timer = deleting.current.get(id);
          if (timer === undefined) return;
          clearTimeout(timer);
          deleting.current.delete(id);
          setTasks((prev) => (prev.some((t) => t.id === id) ? prev : [...prev.slice(0, index), gone, ...prev.slice(index)]));
          setNotice(null);
        },
      });
    },
    [api, fail, say]
  );
  // leaving the page inside those few seconds still deletes
  useEffect(() => {
    const flush = () => {
      for (const [id, timer] of deleting.current) {
        clearTimeout(timer);
        void fetch(`/api/backstage/tasks/${id}`, { method: "DELETE", credentials: "same-origin", keepalive: true });
      }
      deleting.current.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const addProject = useCallback(
    async (name: string, color: string, due_date: string | null = null, owner: Owner | null = null, list: ListName = "work") => {
      try {
        const p = await api<Project>("/projects", { method: "POST", body: { name, color, due_date, owner: owner ?? undefined, list } });
        setProjects((prev) => [...prev, p]);
      } catch (e) {
        fail(e);
      }
    },
    [api, fail]
  );

  const patchProject = useCallback(
    (id: string, patch: { name?: string; color?: string; due_date?: string | null; owner?: Owner; list?: ListName }) => {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      // a project's own tasks move with it between Work and Personal
      const to = patch.list;
      if (to) setTasks((prev) => prev.map((t) => (t.project_id === id && t.owner !== "joint" && t.list !== to ? { ...t, list: to } : t)));
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
    files,
    uploadFile,
    deleteFile,
    fileLink,
    wedding,
    weddingCall,
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
    onIncoming,
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
    clearVotes,
    isSaving,
    nudge,
    setBirthday,
    markChatRead,
    say,
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
