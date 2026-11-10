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

// Backstage only admits verified email addresses. A fresh account must be
// kept out: either Neon Auth refuses the sign-in, or our API answers 403.
const tokenFor = async () => (await authRequest("/token")).json?.token;
const rawState = async (tok) =>
  fetch(apiBase + "/state", { headers: { Authorization: `Bearer ${tok}` } });

let si = await authRequest("/sign-in/email", { method: "POST", body: { email, password } });
if (si.status === 200) {
  const early = await tokenFor();
  const r = early ? await rawState(early) : { status: 0 };
  const body = early ? await r.json().catch(() => ({})) : {};
  const alreadyVerified = r.status === 200 || (r.status === 403 && body.code !== "unverified");
  step(
    "auth: unverified account is kept out by the API",
    alreadyVerified || (r.status === 403 && body.code === "unverified"),
    alreadyVerified ? "account was already verified" : `status ${r.status} ${body.code ?? ""}`
  );
} else {
  step(
    "auth: unverified account is refused at sign-in",
    /verif/i.test(JSON.stringify(si.json)),
    si.json?.message ?? `status ${si.status}`
  );
}

// A test run can't read the emailed code. With E2E_DATABASE_URL set, the test
// marks its own account verified in Neon Auth's table and removes it at the end.
const dbUrl = process.env.E2E_DATABASE_URL;
let pgClient = null;
if (dbUrl) {
  const { default: pg } = await import("pg");
  pgClient = new pg.Client({ connectionString: dbUrl });
  await pgClient.connect();
  await pgClient.query(`update neon_auth."user" set "emailVerified" = true where email = $1`, [email]);
  jar.clear();
  si = await authRequest("/sign-in/email", { method: "POST", body: { email, password } });
}
const finish = async (code) => {
  if (pgClient) {
    const u = (await pgClient.query(`select id from neon_auth."user" where email = $1`, [email])).rows[0];
    if (u) {
      for (const t of ["session", "account", "member"]) {
        await pgClient.query(`delete from neon_auth."${t}" where "userId" = $1`, [u.id]).catch(() => {});
      }
      await pgClient.query(`delete from neon_auth."user" where id = $1`, [u.id]);
      console.log("     test account removed");
    }
    await pgClient.end();
  }
  process.exit(code);
};

step("auth: sign-in once verified", si.status === 200, si.json?.message ?? `status ${si.status}`);
if (si.status !== 200) {
  console.log("     Verify the test address first, or set E2E_DATABASE_URL so the test can.");
  await finish(1);
}

const token = await tokenFor();
step("auth: JWT issued", typeof token === "string" && token.length > 20);
if (!token) await finish(1);

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
  await finish(failures ? 1 : 0);
}
if (st.status !== 200) await finish(1);
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

const t4 = await api("/tasks", "POST", { title: "E2E second task", list: "work", project_id: pr.data.id });
const mv = await api(`/tasks/${t4.data.id}`, "PATCH", { position: 41.5, status: "doing" });
step("api: move and reorder a card", mv.status === 200 && mv.data.position === 41.5 && mv.data.status === "doing");

const pc = await api(`/projects/${pr.data.id}`, "PATCH", { color: "#1f6f6b" });
step("api: recolour project", pc.status === 200 && pc.data.color === "#1f6f6b");

const delT = await api(`/tasks/${t1.data.id}`, "DELETE");
step("api: delete task", delT.status === 200);
const delP = await api(`/projects/${pr.data.id}`, "DELETE");
step("api: delete project", delP.status === 200);
const after = await api("/state");
const kept = (after.data.tasks || []).find((t) => t.id === t4.data.id);
step("api: deleting a project keeps its tasks", !!kept && kept.project_id === null);
await api(`/tasks/${t4.data.id}`, "DELETE");

// contact form -> Messages in Backstage
const post = (body) =>
  fetch(siteBase.replace(/\/+$/, "") + "/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const badMsg = await post({ name: "E2E", email: "not-an-email", message: "hello there" });
step("contact: rejects a bad email", badMsg.status === 400, `status ${badMsg.status}`);
const mark = `E2E contact ${Date.now()}`;
const okMsg = await post({ name: "E2E Visitor", email: "visitor@example.com", company: "Test Co", message: mark });
step("contact: stores a message", okMsg.status === 201, `status ${okMsg.status}`);
const again = await post({ name: "E2E Visitor", email: "visitor@example.com", message: mark + " again" });
step("contact: second message within 30s is held back", again.status === 429, `status ${again.status}`);
const inbox = await api("/state");
const got = (inbox.data.messages || []).find((m) => m.message === mark);
step("backstage: message appears, unread", !!got && got.read_at === null);
if (got) {
  const rd = await api(`/messages/${got.id}`, "PATCH", { read: true });
  step("backstage: mark message read", rd.status === 200 && !!rd.data.read_at);
  const dm = await api(`/messages/${got.id}`, "DELETE");
  step("backstage: delete message", dm.status === 200);
}

console.log(failures ? `\n${failures} step(s) failed.` : "\nAll end-to-end steps passed.");
await finish(failures ? 1 : 0);
