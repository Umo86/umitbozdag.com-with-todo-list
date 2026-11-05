// End-to-end test: Neon Auth sign-up/sign-in -> JWT -> Backstage API CRUD
// against a running instance of the site.
//
// Usage: node test/e2e.mjs <siteBaseUrl> <neonAuthBaseUrl> <email> <password>
//
// The auth handshake uses node:https directly because Neon Auth requires an
// Origin header, which Node's fetch() strips (it's a fetch-spec forbidden
// header; browsers send it automatically, so the real app is unaffected).
import https from "node:https";

const [siteBase, authUrl, email, password] = process.argv.slice(2);
if (!siteBase || !authUrl || !email || !password) {
  console.error("Usage: node test/e2e.mjs <siteBaseUrl> <neonAuthBaseUrl> <email> <password>");
  process.exit(1);
}
const siteOrigin = new URL(siteBase).origin;
const apiBase = siteBase.replace(/\/+$/, "") + "/api/backstage";

let failures = 0;
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

// ——— Neon Auth REST handshake (with Origin header) ———
const jar = new Map();
function storeCookies(setCookie = []) {
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function authRequest(path, { method = "GET", body } = {}) {
  const url = new URL(authUrl.replace(/\/+$/, "") + path);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          Origin: siteOrigin,
          ...(payload ? { "content-type": "application/json" } : {}),
          ...(jar.size ? { cookie: cookieHeader() } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          storeCookies(res.headers["set-cookie"]);
          let json = {};
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode ?? 0, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const su = await authRequest("/sign-up/email", {
  method: "POST",
  body: { email, password, name: "E2E Test" },
});
const suOk = su.status === 200 || /exist/i.test(su.json?.message ?? "");
step("auth: sign-up (or already exists)", suOk, su.json?.message ?? `status ${su.status}`);

const si = await authRequest("/sign-in/email", {
  method: "POST",
  body: { email, password },
});
step("auth: sign-in", si.status === 200, si.json?.message ?? `status ${si.status}`);
if (si.status !== 200) {
  if (/verif/i.test(JSON.stringify(si.json))) {
    console.log(
      "     Sign-in blocked by email verification. Verify the address (or set emailVerified in neon_auth.\"user\") and rerun."
    );
  }
  process.exit(1);
}

const tk = await authRequest("/token");
const token = tk.json?.token;
step("auth: JWT issued", typeof token === "string" && token.length > 20, `status ${tk.status}`);
if (!token) process.exit(1);

// ——— site + API checks ———
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

for (const p of ["/", "/cv", "/backstage"]) {
  const r = await fetch(siteBase.replace(/\/+$/, "") + p);
  step(`site: GET ${p}`, r.status === 200, `status ${r.status}`);
}

const anon = await fetch(apiBase + "/state");
step("api: rejects missing token", anon.status === 401, `status ${anon.status}`);
const badTok = await fetch(apiBase + "/state", {
  headers: { Authorization: "Bearer not-a-real-token" },
});
step("api: rejects invalid token", badTok.status === 401, `status ${badTok.status}`);

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

const pr = await api("/projects", "POST", { name: "E2E project", color: "#3f5fae" });
step("api: create project", pr.status === 201 && !!pr.data.id, pr.data.error || pr.data.id);

const t1 = await api("/tasks", "POST", {
  title: "E2E task",
  project_id: pr.data.id,
  list: "work",
  due_date: "2026-10-30",
  remind_at: "2026-10-30T09:00:00Z",
  priority: "high",
});
step("api: create task", t1.status === 201 && !!t1.data.id, t1.data.error || t1.data.id);
step("api: task lands on the Work list", t1.data.list === "work", t1.data.list);
step("api: reminder stored", !!t1.data.remind_at, String(t1.data.remind_at));

const tl = await api(`/tasks/${t1.data.id}`, "PATCH", { list: "personal" });
step("api: move task to Personal", tl.status === 200 && tl.data.list === "personal");

const badList = await api("/tasks", "POST", { title: "Nope", list: "shopping" });
step("api: rejects unknown list", badList.status === 400);

const t2 = await api(`/tasks/${t1.data.id}`, "PATCH", { status: "doing" });
step("api: start task", t2.status === 200 && t2.data.status === "doing");

const t3 = await api(`/tasks/${t1.data.id}`, "PATCH", { status: "done" });
step(
  "api: complete task (sets completed_at)",
  t3.status === 200 && t3.data.status === "done" && !!t3.data.completed_at
);

const bad = await api("/tasks", "POST", { title: "" });
step("api: rejects empty title", bad.status === 400);

const delT = await api(`/tasks/${t1.data.id}`, "DELETE");
step("api: delete task", delT.status === 200);
const delP = await api(`/projects/${pr.data.id}`, "DELETE");
step("api: delete project", delP.status === 200);

console.log(failures ? `\n${failures} step(s) failed.` : "\nAll end-to-end steps passed.");
process.exit(failures ? 1 : 0);
