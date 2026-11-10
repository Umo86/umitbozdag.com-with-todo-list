"use client";

// Everything Backstage needs from the outside world: the Neon Auth session,
// the /api/backstage calls, and the board's data with optimistic updates.
import { useCallback, useEffect, useRef, useState } from "react";
import { createAuthClient } from "@neondatabase/auth";
import type { Message, Project, Role, Task, TaskPatch } from "./types";

type AuthResult = { data?: unknown; error?: { message?: string; code?: string; status?: number } | null } | null;
type AuthLike = {
  getSession(): Promise<AuthResult>;
  signOut(): Promise<unknown>;
  signIn: {
    email(a: { email: string; password: string }): Promise<AuthResult>;
    social(a: { provider: string; callbackURL: string }): Promise<AuthResult>;
  };
  signUp: { email(a: { email: string; password: string; name: string }): Promise<AuthResult> };
  emailOtp?: {
    sendVerificationOtp(a: { email: string; type: string }): Promise<AuthResult>;
    verifyEmail(a: { email: string; otp: string }): Promise<AuthResult>;
  };
  getJWTToken?(allowAnonymous?: boolean): Promise<string | null>;
  token?(): Promise<{ data?: { token?: string } | null } | null>;
};

export type Phase =
  | { kind: "loading" }
  | { kind: "noconfig" }
  | { kind: "signin" }
  | { kind: "signup" }
  | { kind: "verify"; email: string }
  | { kind: "locked"; message: string }
  | { kind: "app" };

class ApiError extends Error {
  status: number;
  code?: string;
  email?: string;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.error ?? "Something went wrong."));
    this.status = status;
    if (typeof body.code === "string") this.code = body.code;
    if (typeof body.email === "string") this.email = body.email;
  }
}

async function tokenOf(auth: AuthLike): Promise<string | null> {
  if (typeof auth.getJWTToken === "function") return auth.getJWTToken(false);
  if (typeof auth.token === "function") return (await auth.token())?.data?.token ?? null;
  return null;
}

const needsVerifying = (msg?: string) => !!msg && /verif/i.test(msg);

export function useBackstage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<{ email: string; name: string; role: Role } | null>(null);
  const [notice, setNotice] = useState("");
  const authRef = useRef<AuthLike | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3200);
  }, []);

  const api = useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      const auth = authRef.current;
      const token = auth ? await tokenOf(auth).catch(() => null) : null;
      if (!token) throw new ApiError(401, { error: "Sign in to use Backstage." });
      const res = await fetch(`/api/backstage${path}`, {
        method: init?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
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
        email: string;
        name: string;
        role: Role;
        projects: Project[];
        tasks: Task[];
        messages?: Message[];
      }>("/state");
      setProjects(data.projects ?? []);
      setTasks(data.tasks ?? []);
      setMessages(data.messages ?? []);
      setMe({ email: data.email, name: data.name, role: data.role });
      setPhase({ kind: "app" });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setPhase({ kind: "signin" });
      else if (err.status === 403 && err.code === "unverified")
        setPhase({ kind: "verify", email: err.email ?? "" });
      else if (err.status === 403) setPhase({ kind: "locked", message: err.message });
      else say(`Can't reach Backstage right now. ${err.message}`);
    }
  }, [api, say]);

  // boot: read the public config, create the auth client, look for a session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = (await (await fetch("/api/backstage/config")).json()) as { authUrl?: string };
        if (cancelled) return;
        if (!cfg.authUrl) return setPhase({ kind: "noconfig" });
        authRef.current = createAuthClient(cfg.authUrl) as unknown as AuthLike;
        const s = (await authRef.current.getSession().catch(() => null)) as {
          data?: { user?: unknown; session?: unknown } | null;
        } | null;
        if (cancelled) return;
        if (s?.data?.user || s?.data?.session) await refresh();
        else setPhase({ kind: "signin" });
      } catch {
        if (!cancelled) setPhase({ kind: "noconfig" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // ——— sign-in actions (each returns an error message, or "" on success) ———
  const signIn = useCallback(
    async (email: string, password: string): Promise<string> => {
      try {
        const res = await authRef.current!.signIn.email({ email, password });
        if (res?.error) {
          if (needsVerifying(res.error.message) || res.error.status === 403) {
            setPhase({ kind: "verify", email });
            return "";
          }
          return res.error.message ?? "That didn't work. Check the details and try again.";
        }
        await refresh();
        return "";
      } catch {
        return "Can't reach the sign-in service. Check your connection and try again.";
      }
    },
    [refresh]
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<string> => {
      try {
        const res = await authRef.current!.signUp.email({ email, password, name: name || "Umit" });
        if (res?.error) return res.error.message ?? "That didn't work. Check the details and try again.";
        // The server only lets verified addresses in; go straight to the code.
        setPhase({ kind: "verify", email });
        return "";
      } catch {
        return "Can't reach the sign-in service. Check your connection and try again.";
      }
    },
    []
  );

  const signInWithGoogle = useCallback(async (): Promise<string> => {
    try {
      const res = await authRef.current!.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/backstage`,
      });
      return res?.error ? res.error.message ?? "Google sign-in didn't start." : "";
    } catch {
      return "Can't reach the sign-in service. Check your connection and try again.";
    }
  }, []);

  const sendCode = useCallback(async (email: string): Promise<string> => {
    const otp = authRef.current?.emailOtp;
    if (!otp) return "Email codes aren't available. Use Google sign-in instead.";
    try {
      const res = await otp.sendVerificationOtp({ email, type: "email-verification" });
      return res?.error ? res.error.message ?? "The code couldn't be sent." : "";
    } catch {
      return "The code couldn't be sent. Try again in a moment.";
    }
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string): Promise<string> => {
      const otp = authRef.current?.emailOtp;
      if (!otp) return "Email codes aren't available. Use Google sign-in instead.";
      try {
        const res = await otp.verifyEmail({ email, otp: code.trim() });
        if (res?.error) return res.error.message ?? "That code didn't match.";
        const token = await tokenOf(authRef.current!).catch(() => null);
        if (token) await refresh();
        else setPhase({ kind: "signin" });
        return "";
      } catch {
        return "That code couldn't be checked. Try again.";
      }
    },
    [refresh]
  );

  const signOut = useCallback(() => {
    const done = () => {
      setTasks([]);
      setMessages([]);
      setProjects([]);
      setMe(null);
      setPhase({ kind: "signin" });
    };
    authRef.current?.signOut().then(done, done);
  }, []);

  // ——— board actions (optimistic; the server's answer replaces the guess) ———
  const fail = useCallback(
    (e: unknown) => {
      say((e as Error).message);
      void refresh();
    },
    [say, refresh]
  );

  const addTask = useCallback(
    async (body: { title: string; list: string; project_id?: string | null }) => {
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

  const patchTask = useCallback(
    (id: string, patch: TaskPatch) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      api<Task>(`/tasks/${id}`, { method: "PATCH", body: patch }).then(
        (t) => setTasks((prev) => prev.map((x) => (x.id === id ? t : x))),
        fail
      );
    },
    [api, fail]
  );

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      api(`/tasks/${id}`, { method: "DELETE" }).catch(fail);
    },
    [api, fail]
  );

  const addProject = useCallback(
    async (name: string, color: string) => {
      try {
        const p = await api<Project>("/projects", { method: "POST", body: { name, color } });
        setProjects((prev) => [...prev, p]);
      } catch (e) {
        fail(e);
      }
    },
    [api, fail]
  );

  const patchProject = useCallback(
    (id: string, patch: { name?: string; color?: string }) => {
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
    signIn,
    signUp,
    signInWithGoogle,
    sendCode,
    verifyCode,
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
