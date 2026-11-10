// End-to-end test against a running instance of the site: the password
// gate, then task, project and message handling in Backstage.
//
// Usage: node test/e2e.mjs <siteBaseUrl> <backstagePassword>
const [siteBase, password] = process.argv.slice(2);
if (!siteBase || !password) {
  console.error("Usage: node test/e2e.mjs <siteBaseUrl> <backstagePassword>");
  process.exit(1);
}
const root = siteBase.replace(/\/+$/, "");
const apiBase = root + "/api/backstage";
const origin = new URL(siteBase).origin;

let failures = 0;
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};
const finish = async (code) => process.exit(code);

let cookie = "";
const call = async (path, method = "GET", body, headers = {}) => {
  const res = await fetch(apiBase + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data, setCookie: res.headers.getSetCookie?.() ?? [] };
};
const api = (path, method, body) => call(path, method, body);

// ——— the door ———
const cfg = await call("/config");
step("setup: password and database in place", cfg.data.password === "ok" && cfg.data.database === "ok", JSON.stringify(cfg.data));

const anon = await call("/state");
step("gate: no session, no board", anon.status === 401, `status ${anon.status}`);

const wrong = await call("/login", "POST", { password: password + "x" });
step("gate: wrong password refused", wrong.status === 401 && wrong.setCookie.length === 0, `status ${wrong.status}`);

const forged = await call("/state", "GET", undefined, { cookie: "backstage_session=not-a-real-session" });
step("gate: forged session refused", forged.status === 401, `status ${forged.status}`);

const login = await call("/login", "POST", { password });
const session = login.setCookie.find((c) => c.startsWith("backstage_session="));
step("gate: right password opens a session", login.status === 200 && !!session, `status ${login.status}`);
if (!session) await finish(1);
step("gate: session cookie is HttpOnly", /httponly/i.test(session) && /samesite=lax/i.test(session));
cookie = session.split(";")[0];

const foreign = await call("/tasks", "POST", { title: "from another site" }, { Origin: "https://evil.example" });
step("gate: request from another site refused", foreign.status === 403, `status ${foreign.status}`);

// ——— site + API checks ———
for (const p of ["/", "/cv", "/backstage"]) {
  const r = await fetch(root + p);
  step(`site: GET ${p}`, r.status === 200, `status ${r.status}`);
}


const st = await api("/state");
step("api: GET /state", st.status === 200, `status ${st.status} ${st.data.error ?? ""}`);
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

// project deadlines
const pd = await api(`/projects/${pr.data.id}`, "PATCH", { due_date: "2027-05-06" });
step("api: set a project deadline", pd.status === 200 && pd.data.due_date === "2027-05-06", JSON.stringify(pd.data));
const pd2 = await api(`/projects/${pr.data.id}`, "PATCH", { due_date: null });
step("api: clear a project deadline", pd2.status === 200 && pd2.data.due_date === null && pd2.data.color === "#1f6f6b");
const pn = await api("/projects", "POST", { name: "E2E dated project", color: "#1a47ff", due_date: "2027-01-15" });
step("api: new project with a deadline", pn.status === 201 && pn.data.due_date === "2027-01-15");
await api(`/projects/${pn.data.id}`, "DELETE");

// repeating tasks: finishing one creates the next, once
const rep = await api("/tasks", "POST", {
  title: "E2E weekly report", list: "work", repeat: "weekly",
  due_date: "2026-11-16", remind_at: "2026-11-16T09:00:00Z",
});
step("api: create a repeating task", rep.status === 201 && rep.data.repeat === "weekly", rep.data.error || rep.data.repeat);
const repDone = await api(`/tasks/${rep.data.id}`, "PATCH", { status: "done" });
const sp = repDone.data.spawned;
step("api: finishing it adds the next one", repDone.status === 200 && !!sp && sp.due_date === "2026-11-23" && sp.repeat === "weekly" && sp.status === "todo", JSON.stringify(sp ?? repDone.data));
step("api: the next one keeps its reminder time", !!sp && new Date(sp.remind_at).toISOString() === "2026-11-23T09:00:00.000Z", sp?.remind_at);
await api(`/tasks/${rep.data.id}`, "PATCH", { status: "todo" });
const again2 = await api(`/tasks/${rep.data.id}`, "PATCH", { status: "done" });
step("api: ticking it again doesn't add a second copy", again2.status === 200 && !again2.data.spawned);
const badRep = await api("/tasks", "POST", { title: "E2E bad repeat", repeat: "hourly" });
step("api: unknown repeat is ignored on create", badRep.status === 201 && badRep.data.repeat === null);
const badRep2 = await api(`/tasks/${rep.data.id}`, "PATCH", { repeat: "hourly" });
step("api: unknown repeat refused on edit", badRep2.status === 400);
for (const id of [rep.data.id, sp?.id, badRep.data.id]) if (id) await api(`/tasks/${id}`, "DELETE");

// reading speech: without an AI key the server says so and the page uses its own rules
const parse = await api("/parse", "POST", { text: "call the venue tomorrow", now_local: "2026-11-10T20:00", projects: [] });
step("api: /parse answers (501 = AI off, 200 = AI on)", parse.status === 501 || (parse.status === 200 && Array.isArray(parse.data.drafts)), `status ${parse.status}`);

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
  fetch(root + "/api/contact", {
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

const out = await call("/logout", "POST", {});
cookie = (out.setCookie.find((c) => c.startsWith("backstage_session=")) ?? "backstage_session=").split(";")[0];
const after2 = await call("/state");
step("gate: signing out closes the board", out.status === 200 && after2.status === 401, `status ${after2.status}`);

console.log(failures ? `\n${failures} step(s) failed.` : "\nAll end-to-end steps passed.");
await finish(failures ? 1 : 0);
