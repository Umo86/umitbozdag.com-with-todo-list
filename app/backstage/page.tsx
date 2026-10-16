"use client";

// Backstage — the private production office: Neon Auth sign-in,
// projects and tasks stored in Lakebase Postgres via /api/backstage.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  createAuthClient,
  type VanillaBetterAuthClient,
} from "@neondatabase/auth";

type AuthClient = VanillaBetterAuthClient;

// The JWT for API calls: the client exposes getJWTToken() at runtime
// (README), with the Better Auth jwt plugin's token() as the fallback.
async function getToken(auth: AuthClient): Promise<string | null> {
  const a = auth as unknown as {
    getJWTToken?: (allowAnonymous?: boolean) => Promise<string | null>;
    token?: () => Promise<{ data?: { token?: string } | null } | null>;
  };
  if (typeof a.getJWTToken === "function") return a.getJWTToken(false);
  if (typeof a.token === "function") {
    const r = await a.token();
    return r?.data?.token ?? null;
  }
  return null;
}

type Project = { id: string; name: string; color: string; position: number };
type Task = {
  id: string;
  project_id: string | null;
  title: string;
  notes: string | null;
  status: "todo" | "doing" | "done";
  priority: "low" | "normal" | "high";
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
};

type Phase =
  | "loading"
  | "noconfig"
  | "signin"
  | "signup"
  | { locked: string }
  | "app";

const SWATCHES = ["#d64553", "#f2efe9", "#1f6f6b", "#b3741f", "#3f5fae", "#6d3b8e"];

class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function fmtDue(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
function isPast(d: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(d + "T00:00:00") < today;
}

export default function BackstagePage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [email, setEmail] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [banner, setBanner] = useState("");
  const [toast, setToast] = useState("");
  const authRef = useRef<AuthClient | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  const api = useCallback(async (path: string, init?: { method?: string; body?: unknown }) => {
    const auth = authRef.current;
    if (!auth) throw new ApiError(401, "Sign in to use Backstage.");
    const token = await getToken(auth).catch(() => null);
    if (!token) throw new ApiError(401, "Sign in to use Backstage.");
    const res = await fetch(`/api/backstage${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    let data: Record<string, unknown> = {};
    try {
      data = await res.json();
    } catch {
      /* no body */
    }
    if (!res.ok) {
      throw new ApiError(res.status, String(data.error ?? "Something went wrong."));
    }
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = (await api("/state")) as unknown as {
        email: string;
        projects: Project[];
        tasks: Task[];
      };
      setProjects(data.projects ?? []);
      setTasks(data.tasks ?? []);
      setEmail(data.email ?? "");
      setBanner("");
      setPhase("app");
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 401) setPhase("signin");
      else if (err.code === 403) setPhase({ locked: err.message });
      else setBanner(`Can't reach the Backstage API right now — ${err.message}`);
    }
  }, [api]);

  // boot: fetch config, create the auth client, check the session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/backstage/config");
        const cfg = (await res.json()) as { authUrl?: string };
        if (cancelled) return;
        if (!cfg.authUrl) {
          setPhase("noconfig");
          return;
        }
        authRef.current = createAuthClient(cfg.authUrl) as AuthClient;
        const s = (await authRef.current.getSession().catch(() => null)) as unknown as {
          data?: { user?: unknown; session?: { user?: unknown } };
          user?: unknown;
        } | null;
        if (cancelled) return;
        const user = s?.data?.user ?? s?.data?.session?.user ?? s?.user;
        if (user) {
          setPhase("app");
          await refresh();
        } else {
          setPhase("signin");
        }
      } catch {
        if (!cancelled) setPhase("noconfig");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const signOut = useCallback(() => {
    authRef.current?.signOut().finally(() => setPhase("signin"));
  }, []);

  // ——— derived ———
  const openCount = useCallback(
    (pid: string | null) =>
      tasks.filter((t) => t.status !== "done" && (pid === null ? true : t.project_id === pid))
        .length,
    [tasks]
  );
  const visible = useMemo(
    () => tasks.filter((t) => filter === null || t.project_id === filter),
    [tasks, filter]
  );
  const doing = visible.filter((t) => t.status === "doing");
  const todo = visible.filter((t) => t.status === "todo");
  const done = visible.filter((t) => t.status === "done");
  const projById = useCallback(
    (id: string | null) => projects.find((p) => p.id === id),
    [projects]
  );

  const patchTask = useCallback(
    (id: string, body: Record<string, unknown>) => {
      api(`/tasks/${id}`, { method: "PATCH", body })
        .then(refresh)
        .catch((e) => showToast((e as Error).message));
    },
    [api, refresh, showToast]
  );

  // ——— gate views ———
  if (phase !== "app") {
    return (
      <div className="bs-gate">
        <div className="bs-card">
          <h1>Backstage</h1>
          <p className="sub">The private production office for umitbozdag.com</p>
          {phase === "loading" && <p className="notice quiet">Opening…</p>}
          {phase === "noconfig" && (
            <p className="notice">
              Backstage isn&rsquo;t connected yet. The server needs{" "}
              <code>NEON_AUTH_BASE_URL</code> (and the other Neon environment
              values) — finish the Neon setup, redeploy, and reload this page.
            </p>
          )}
          {typeof phase === "object" && "locked" in phase && (
            <>
              <p className="notice">{phase.locked}</p>
              <button className="btn" onClick={signOut}>
                Sign out
              </button>
            </>
          )}
          {(phase === "signin" || phase === "signup") && (
            <AuthForm
              mode={phase}
              onSwitch={() => setPhase(phase === "signin" ? "signup" : "signin")}
              onDone={refresh}
              authRef={authRef}
            />
          )}
        </div>
      </div>
    );
  }

  // ——— app ———
  return (
    <div className="bs-app">
      <header className="bs-head">
        <div>
          <h1 style={{ display: "inline" }}>Backstage</h1>
          <span className="today">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="who">
          <span>{email}</span>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      {banner && <div className="bs-banner">{banner}</div>}

      <div className="bs-cols">
        <aside className="bs-rail">
          <h2>Projects</h2>
          <ul>
            <li
              className={filter === null ? "active" : ""}
              onClick={() => setFilter(null)}
            >
              <span className="bs-dot" style={{ background: "var(--muted)" }} />
              Everything
              <span className="count">{openCount(null)}</span>
            </li>
            {projects.map((p) => (
              <li
                key={p.id}
                className={filter === p.id ? "active" : ""}
                onClick={() => setFilter(p.id)}
              >
                <span className="bs-dot" style={{ background: p.color }} />
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const name = prompt("Rename project", p.name);
                    if (name && name.trim() && name.trim() !== p.name) {
                      api(`/projects/${p.id}`, {
                        method: "PATCH",
                        body: { name: name.trim() },
                      })
                        .then(refresh)
                        .catch((err) => showToast((err as Error).message));
                    }
                  }}
                >
                  {p.name}
                </span>
                <span className="count">{openCount(p.id)}</span>
                <button
                  className="del"
                  aria-label={`Delete ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirm(`Delete "${p.name}" and its tasks? This can't be undone.`))
                      return;
                    api(`/projects/${p.id}`, { method: "DELETE" })
                      .then(() => {
                        if (filter === p.id) setFilter(null);
                        return refresh();
                      })
                      .catch((err) => showToast((err as Error).message));
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <NewProject
            onCreate={(name, color) =>
              api("/projects", { method: "POST", body: { name, color } })
                .then(() => refresh())
                .then(() => showToast("Project added."))
                .catch((err) => showToast((err as Error).message))
            }
          />
        </aside>

        <main>
          <QuickAdd
            projects={projects}
            filter={filter}
            onAdd={(body) =>
              api("/tasks", { method: "POST", body })
                .then(() => refresh())
                .then(() => showToast("Task added."))
                .catch((err) => showToast((err as Error).message))
            }
          />

          {visible.length === 0 ? (
            <p className="bs-empty">Nothing on the schedule. Add the first task above.</p>
          ) : (
            <>
              <Group title="In progress" items={doing} {...{ projById, patchTask, api, refresh, showToast, reduce }} />
              <Group title="To do" items={todo} {...{ projById, patchTask, api, refresh, showToast, reduce }} />
              {done.length > 0 && (
                <details className="bs-done">
                  <summary>Done — {done.length}</summary>
                  {done.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      {...{ projById, patchTask, api, refresh, showToast }}
                    />
                  ))}
                </details>
              )}
            </>
          )}
        </main>
      </div>

      {toast && <div className="bs-toast">{toast}</div>}
    </div>
  );
}

// ——— pieces ———

function AuthForm({
  mode,
  onSwitch,
  onDone,
  authRef,
}: {
  mode: "signin" | "signup";
  onSwitch: () => void;
  onDone: () => void;
  authRef: React.RefObject<AuthClient | null>;
}) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === "signup";
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const fd = new FormData(f);
          const creds = {
            email: String(fd.get("email") ?? "").trim(),
            password: String(fd.get("password") ?? ""),
          };
          setErr("");
          setBusy(true);
          try {
            const auth = authRef.current!;
            const res = isSignUp
              ? await auth.signUp.email({
                  ...creds,
                  name: String(fd.get("name") ?? "").trim() || "Umit",
                })
              : await auth.signIn.email(creds);
            if (res?.error) {
              setErr(res.error.message ?? "That didn't work — check the details and try again.");
            } else {
              onDone();
            }
          } catch {
            setErr("Can't reach the sign-in service. Check your connection and try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {isSignUp && (
          <>
            <label htmlFor="f-name">Your name</label>
            <input id="f-name" name="name" defaultValue="Umit" maxLength={80} />
          </>
        )}
        <label htmlFor="f-email">Email</label>
        <input id="f-email" name="email" type="email" required autoComplete="username" />
        <label htmlFor="f-pass">Password</label>
        <input
          id="f-pass"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
        <div className="error-line">{err}</div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "One moment…" : isSignUp ? "Create the owner account" : "Sign in"}
        </button>
      </form>
      <p className="switch">
        {isSignUp ? "Already set up? " : "First visit? "}
        <button type="button" onClick={onSwitch}>
          {isSignUp ? "Sign in" : "Create the owner account"}
        </button>
      </p>
    </>
  );
}

function NewProject({
  onCreate,
}: {
  onCreate: (name: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(SWATCHES[0]);
  return (
    <>
      <button className="addproj" onClick={() => setOpen((v) => !v)}>
        + New project
      </button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("pname") ?? "").trim();
            if (!name) return;
            onCreate(name, color);
            setOpen(false);
          }}
        >
          <input name="pname" placeholder="Project name" maxLength={120} autoFocus />
          <div className="bs-swatches">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className="bs-swatch"
                style={{ background: c }}
                aria-pressed={color === c}
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="btn ghost" type="submit" style={{ width: "100%" }}>
            Add project
          </button>
        </form>
      )}
    </>
  );
}

function QuickAdd({
  projects,
  filter,
  onAdd,
}: {
  projects: Project[];
  filter: string | null;
  onAdd: (body: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="bs-quickadd"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const fd = new FormData(f);
        const title = String(fd.get("title") ?? "").trim();
        if (!title) return;
        const body: Record<string, unknown> = {
          title,
          priority: String(fd.get("priority") ?? "normal"),
        };
        const pid = String(fd.get("project_id") ?? "");
        const due = String(fd.get("due_date") ?? "");
        if (pid) body.project_id = pid;
        if (due) body.due_date = due;
        onAdd(body);
        f.reset();
      }}
    >
      <input name="title" placeholder="Add a task — what needs doing?" maxLength={500} required />
      <select name="project_id" defaultValue={filter ?? ""} key={filter ?? "none"}>
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input name="due_date" type="date" aria-label="Due date" />
      <select name="priority" defaultValue="normal" aria-label="Priority">
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="low">Low</option>
      </select>
      <button className="btn" type="submit">
        Add task
      </button>
    </form>
  );
}

type RowCtx = {
  projById: (id: string | null) => Project | undefined;
  patchTask: (id: string, body: Record<string, unknown>) => void;
  api: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;
  refresh: () => Promise<void>;
  showToast: (msg: string) => void;
};

function Group({
  title,
  items,
  reduce,
  ...ctx
}: { title: string; items: Task[]; reduce: boolean | null } & RowCtx) {
  if (!items.length) return null;
  return (
    <div className="bs-group">
      <h2>
        {title} <span className="n">{items.length}</span>
      </h2>
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.25 }}
          >
            <TaskRow task={t} {...ctx} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function TaskRow({ task: t, projById, patchTask, api, refresh, showToast }: { task: Task } & RowCtx) {
  const [editing, setEditing] = useState(false);
  const p = projById(t.project_id);
  const commitTitle = (v: string) => {
    const title = v.trim();
    setEditing(false);
    if (title && title !== t.title) patchTask(t.id, { title });
  };
  return (
    <div className={`bs-task${t.status === "done" ? " done" : ""}`}>
      <input
        type="checkbox"
        checked={t.status === "done"}
        aria-label="Mark done"
        onChange={(e) => patchTask(t.id, { status: e.target.checked ? "done" : "todo" })}
      />
      <div className="body">
        <div className="title" onDoubleClick={() => setEditing(true)}>
          {editing ? (
            <input
              defaultValue={t.title}
              maxLength={500}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => commitTitle(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle(e.currentTarget.value);
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            t.title
          )}
        </div>
        {(p || t.due_date || t.priority !== "normal") && (
          <div className="meta">
            {p && (
              <span className="proj">
                <span className="bs-dot" style={{ background: p.color }} />
                {p.name}
              </span>
            )}
            {t.due_date && (
              <span className={`due${isPast(t.due_date) && t.status !== "done" ? " past" : ""}`}>
                Due {fmtDue(t.due_date)}
              </span>
            )}
            {t.priority === "high" && <span className="high">High</span>}
            {t.priority === "low" && <span>Low priority</span>}
          </div>
        )}
      </div>
      <div className="ops">
        {t.status === "todo" && (
          <button onClick={() => patchTask(t.id, { status: "doing" })}>Start</button>
        )}
        {t.status === "doing" && (
          <button onClick={() => patchTask(t.id, { status: "todo" })}>Back to list</button>
        )}
        <button onClick={() => setEditing(true)}>Edit</button>
        <button
          aria-label="Delete task"
          onClick={() =>
            api(`/tasks/${t.id}`, { method: "DELETE" })
              .then(() => refresh())
              .catch((err) => showToast((err as Error).message))
          }
        >
          ×
        </button>
      </div>
    </div>
  );
}
