import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Resolve the same source aliases that Next uses, without starting a server.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return next(specifier, context);
} });
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const { previewRequest: request, resetPreview } = await import("../components/backstage/previewStore.ts");
const { visibleTasks } = await import("../lib/task-view.ts");
const { readGuestLine } = await import("../lib/guest-line.ts");
const filters = { search: "", when: "all", priority: "all", order: "manual" };

test("preview persists task CRUD without contacting an API", async () => {
  resetPreview();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Preview must not use the network"); };
  try {
    const task = await request("/tasks", { method: "POST", body: { title: "Preview task", list: "work" } });
    assert.ok((await request("/state")).tasks.some(t => t.id === task.id));
    const changed = await request(`/tasks/${task.id}`, { method: "PATCH", body: { priority: "high", notes: "Need the quote" } });
    assert.equal(changed.priority, "high"); assert.equal(changed.notes, "Need the quote");
    await request(`/tasks/${task.id}`, { method: "DELETE" });
    assert.ok(!(await request("/state")).tasks.some(t => t.id === task.id));
  } finally { globalThis.fetch = oldFetch; }
});

test("a repeating task creates one next occurrence when completed", async () => {
  resetPreview();
  const task = await request("/tasks", { method: "POST", body: { title: "Weekly review", due_date: "2026-11-17", repeat: "weekly" } });
  const changed = await request(`/tasks/${task.id}`, { method: "PATCH", body: { status: "done" } });
  assert.equal(changed.spawned.due_date, "2026-11-24"); assert.equal(changed.spawned.status, "todo");
  const again = await request(`/tasks/${task.id}`, { method: "PATCH", body: { notes: "Reviewed" } });
  assert.equal(again.spawned, undefined);
  assert.equal((await request("/state")).tasks.filter(t => t.title === "Weekly review").length, 2);
  await request(`/tasks/${task.id}`, { method: "PATCH", body: { status: "todo" } });
  await request(`/tasks/${task.id}`, { method: "PATCH", body: { status: "done" } });
  assert.equal((await request("/state")).tasks.filter(t => t.title === "Weekly review").length, 2);
});

test("project moves and deletion retain its tasks", async () => {
  resetPreview();
  const project = await request("/projects", { method: "POST", body: { name: "Test project", color: "#1a47ff", list: "work" } });
  const task = await request("/tasks", { method: "POST", body: { title: "Keep me", project_id: project.id } });
  await request(`/projects/${project.id}`, { method: "PATCH", body: { list: "personal" } });
  assert.equal((await request("/state")).tasks.find(t => t.id === task.id).list, "personal");
  await request(`/projects/${project.id}`, { method: "DELETE" });
  assert.equal((await request("/state")).tasks.find(t => t.id === task.id).project_id, null);
});

test("sample users see their own private tasks and shared tasks", async () => {
  resetPreview();
  const privateTask = await request("/tasks", { method: "POST", body: { title: "Private work" } });
  const shared = await request("/tasks", { method: "POST", body: { title: "Shared", owner: "joint", list: "personal" } });
  await request("/login", { method: "POST", body: { username: "dilfiraz" } });
  const state = await request("/state");
  assert.equal(state.me.id, "dilfiraz"); assert.equal(state.messages.length, 0);
  assert.ok(!state.tasks.some(t => t.id === privateTask.id)); assert.ok(state.tasks.some(t => t.id === shared.id));
});

test("wedding guests count groups, skip duplicates and support editing", async () => {
  resetPreview();
  const wedding = await request("/wedding/guests", { method: "POST", body: { side: "dilfiraz", lines: ["Alex +1", "Kaya family x4", "Alex +1"] } });
  assert.equal(wedding.guests.filter(g => g.side === "dilfiraz").reduce((n, g) => n + g.people, 0), 6);
  const alex = wedding.guests.find(g => g.name === "Alex");
  const moved = await request(`/wedding/guests/${alex.id}`, { method: "PATCH", body: { side: "umit", people: 3 } });
  assert.equal(moved.guests.find(g => g.id === alex.id).side, "umit");
  assert.deepEqual(readGuestLine("1. Alex +1"), { name: "Alex", people: 2 });
});

test("wedding date creates and updates the same shared event", async () => {
  resetPreview();
  let wedding = await request("/wedding", { method: "PATCH", body: { wedding_date: "2027-06-12", budget: "18000" } });
  const eventId = wedding.plan.event_id; assert.equal(wedding.plan.budget, 18000);
  wedding = await request("/wedding", { method: "PATCH", body: { wedding_date: "2027-06-13" } });
  assert.equal(wedding.plan.event_id, eventId);
  assert.equal((await request("/state")).events.find(e => e.id === eventId).start_date, "2027-06-13");
});

test("task search matches notes and filters dates without including completed overdue tasks", async () => {
  resetPreview();
  const state = await request("/state");
  const today = new Date().toLocaleDateString("en-CA");
  assert.ok(visibleTasks(state.tasks, { ...filters, search: "stand sizes" }, today).some(t => t.title === "Send the updated floor plan"));
  assert.ok(visibleTasks(state.tasks, { ...filters, when: "overdue" }, today).every(t => t.status !== "done" && t.due_date < today));
  assert.ok(visibleTasks(state.tasks, { ...filters, priority: "high" }, today).every(t => t.priority === "high"));
  const sorted = visibleTasks(state.tasks, { ...filters, order: "due" }, today);
  assert.ok(sorted.findIndex(t => !t.due_date) >= sorted.filter(t => t.due_date).length);
});

test("local preview refuses unsupported delivery features", async () => {
  await assert.rejects(request("/push/test", { method: "POST" }), /live service/);
});

test("gift ideas stay private when switching sample users", async () => {
  resetPreview();
  const gift = await request("/us", { method: "POST", body: { kind: "gift", title: "A surprise" } });
  assert.equal(gift.owner, "umit");
  await request("/login", { method: "POST", body: { username: "dilfiraz" } });
  assert.ok(!(await request("/state")).us.some(x => x.id === gift.id));
});
