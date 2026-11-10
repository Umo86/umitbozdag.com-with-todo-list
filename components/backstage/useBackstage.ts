"use client";

// Everything Backstage needs from the outside world: the password session,
// the /api/backstage calls, and the board's data with optimistic updates.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListName, Message, Priority, Project, Repeat, Role, Task, TaskPatch } from "./types";
import { localToIso, type Draft } from "@/lib/parse";

export type NewTask = {
  title: string;
  list: ListName;
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
  | { kind: "signin" }
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
  const [me, setMe] = useState<{ name: string; role: Role } | null>(null);
  const [notice, setNotice] = useState("");
  const [ai, setAi] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3200);
  }, []);

  // The session is an HttpOnly cookie, sent automatically to this site.
  const api = useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      const res = await fetch(`/api/backstage${path}`, {
        method: init?.method ?? "GET",
        credentials: "same-origin",
        headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new ApiError(res.status, data);
      return data as T;
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const data = await api<{
        name: string;
        role: Role;
        projects: Project[];
        tasks: Task[];
        messages?: Message[];
      }>("/state");
      setProjects(data.projects ?? []);
      setTasks(data.tasks ?? []);
      setMessages(data.messages ?? []);
      setMe({ name: data.name, role: data.role });
      setPhase({ kind: "app" });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setPhase({ kind: "signin" });
      else if (err.status === 503) setPhase({ kind: "noconfig", missing: "BACKSTAGE_PASSWORD" });
      else {
        // already on the board: keep it and say so; otherwise explain on the gate
        setPhase((prev) =>
          prev.kind === "app"
            ? prev
            : { kind: "locked", message: `Backstage couldn't load. ${err.message}` }
        );
        say(`Can't reach Backstage right now. ${err.message}`);
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
        };
        if (cancelled) return;
        setAi(cfg.ai === "on");
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
    async (password: string): Promise<string> => {
      try {
        await api("/login", { method: "POST", body: { password } });
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
      say((e as Error).message);
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
      for (const d of drafts) {
        try {
          const t = await api<Task>("/tasks", {
            method: "POST",
            body: {
              title: d.title,
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
      return saved;
    },
    [api, say]
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
    async (name: string, color: string, due_date: string | null = null) => {
      try {
        const p = await api<Project>("/projects", { method: "POST", body: { name, color, due_date } });
        setProjects((prev) => [...prev, p]);
      } catch (e) {
        fail(e);
      }
    },
    [api, fail]
  );

  const patchProject = useCallback(
    (id: string, patch: { name?: string; color?: string; due_date?: string | null }) => {
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
    messages,
    notice,
    say,
    ai,
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
