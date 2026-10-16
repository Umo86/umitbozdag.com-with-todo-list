// End-to-end test: Neon Auth sign-up/sign-in -> JWT -> Backstage API CRUD
// against the running Next.js app.
// Usage: node test/e2e.mjs <siteBaseUrl> <authUrl> <email> <password>
import { createAuthClient } from "@neondatabase/auth";

const [siteBase, authUrl, email, password] = process.argv.slice(2);
if (!siteBase || !authUrl || !email || !password) {
  console.error("Usage: node test/e2e.mjs <siteBaseUrl> <authUrl> <email> <password>");
  process.exit(1);
}
const apiBase = siteBase.replace(/\/+$/, "") + "/api/backstage";

// Neon Auth requires an Origin header (browsers always send one; Node's
// fetch doesn't). Attach the site origin to every auth-server request.
const siteOrigin = new URL(siteBase).origin;
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (url && url.startsWith(authUrl)) {
    init = { ...init, headers: { ...(init.headers || {}), Origin: siteOrigin } };
  }
  return realFetch(input, init);
};

let failures = 0;
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

const auth = createAuthClient(authUrl);

const su = await auth
  .signUp.email({ email, password, name: "E2E Test" })
  .catch((e) => ({ error: { message: String(e) } }));
const suOk = !su?.error || /exist/i.test(su.error.message || "");
step("auth: sign-up (or already exists)", suOk, su?.error?.message || "");

const si = await auth
  .signIn.email({ email, password })
  .catch((e) => ({ error: { message: String(e) } }));
step("auth: sign-in", !si?.error, si?.error?.message || "");
if (si?.error) process.exit(1);

let token = null;
if (typeof auth.getJWTToken === "function") token = await auth.getJWTToken(false);
else if (typeof auth.token === "function") token = (await auth.token())?.data?.token ?? null;
step("auth: JWT issued", typeof token === "string" && token.length > 20);
if (!token) process.exit(1);

const api = async (path, method = "GET", body) => {
  const res = await fetch(apiBase + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
};

// pages respond
for (const p of ["/", "/cv", "/backstage"]) {
  const r = await fetch(siteBase.replace(/\/+$/, "") + p);
  step(`site: GET ${p}`, r.status === 200, `status ${r.status}`);
}

// unauthenticated call is rejected
const anon = await fetch(apiBase + "/state");
step("api: rejects missing token", anon.status === 401, `status ${anon.status}`);

// state (seeds defaults on first run)
const st = await api("/state");
step("api: GET /state", st.status === 200, `status ${st.status} ${st.data.error ?? ""}`);
if (st.status === 403) {
  console.log("     (owner lock working — this email is not in ALLOWED_EMAILS)");
  process.exit(failures ? 1 : 0);
}
if (st.status !== 200) process.exit(1);
step(
  "api: seeded starter projects",
  (st.data.projects || []).length > 0,
  `${(st.data.projects || []).length} projects`
);

// project CRUD
const pr = await api("/projects", "POST", { name: "E2E project", color: "#3f5fae" });
step("api: create project", pr.status === 201 && !!pr.data.id, pr.data.error || pr.data.id);

// task CRUD
const t1 = await api("/tasks", "POST", {
  title: "E2E task",
  project_id: pr.data.id,
  due_date: "2026-10-30",
  priority: "high",
});
step("api: create task", t1.status === 201 && !!t1.data.id, t1.data.error || t1.data.id);

const t2 = await api(`/tasks/${t1.data.id}`, "PATCH", { status: "doing" });
step("api: start task", t2.status === 200 && t2.data.status === "doing");

const t3 = await api(`/tasks/${t1.data.id}`, "PATCH", { status: "done" });
step(
  "api: complete task (sets completed_at)",
  t3.status === 200 && t3.data.status === "done" && !!t3.data.completed_at
);

const bad = await api("/tasks", "POST", { title: "" });
step("api: rejects empty title", bad.status === 400);

// clean up test data
const delT = await api(`/tasks/${t1.data.id}`, "DELETE");
step("api: delete task", delT.status === 200);
const delP = await api(`/projects/${pr.data.id}`, "DELETE");
step("api: delete project", delP.status === 200);

console.log(failures ? `\n${failures} step(s) failed.` : "\nAll end-to-end steps passed.");
process.exit(failures ? 1 : 0);
