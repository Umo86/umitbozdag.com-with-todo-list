// Browser-only test data. This transport never opens a session or contacts the
// real API; the authenticated production routes remain unchanged.
import { nextOccurrence, ymd } from "@/lib/parse";
import { STARTER } from "@/lib/wedding-starter";
import { readGuestLine } from "@/lib/guest-line";
import { financePreviewRequest } from "@/components/backstage/financePreview";
import type { CalEvent, ChatMessage, Me, Message, Project, Task, TaskFile, UsItem, Wedding } from "./types";

const KEY = "backstage:preview:v1";
const date = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return ymd(d); };
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const people = [{ id: "umit", name: "Umit", color: "#1a47ff" }, { id: "dilfiraz", name: "Dilfiraz", color: "#e0457b" }] as const;
type State = { me: Me; projects: Project[]; tasks: Task[]; events: CalEvent[]; messages: Message[]; chat: ChatMessage[]; us: UsItem[]; files: TaskFile[]; wedding: Wedding; birthdays: Record<string, string | null>; nextTasks?: Record<string, string> };

function newTask(body: Partial<Task>, me = "umit"): Task {
  return { id: id(), title: "New task", notes: null, list: "work", owner: "umit", added_by: me, assignee: null, wedding: false, area_id: null, project_id: null, priority: "normal", status: "todo", due_date: null, remind_at: null, repeat: null, position: -Date.now(), created_at: now(), updated_at: now(), completed_at: null, completed_by: null, love_note: null, nudges: 0, ...body };
}

function seed(): State {
  return {
    me: { ...people[0], admin: true }, birthdays: {}, files: [], chat: [],
    projects: [
      { id: "preview-ukcw", name: "UKCW", list: "work", color: "#1a47ff", position: 0, due_date: date(21), owner: "umit" },
      { id: "preview-operations", name: "Operations", list: "work", color: "#1f6f6b", position: 1, due_date: null, owner: "umit" },
      { id: "preview-home", name: "Home", list: "personal", color: "#6d3b8e", position: 2, due_date: null, owner: "umit" },
    ],
    tasks: [
      newTask({ title: "Chase the signage quote", project_id: "preview-ukcw", due_date: date(0), priority: "high" }),
      newTask({ title: "Send the updated floor plan", project_id: "preview-ukcw", due_date: date(1), status: "doing", notes: "Confirm the stand sizes before sending the revised plan." }),
      newTask({ title: "Review supplier proposals", project_id: "preview-operations", due_date: date(3) }),
      newTask({ title: "Confirm the production schedule", project_id: "preview-ukcw", due_date: date(-1) }),
      newTask({ title: "Book the dentist", list: "personal", due_date: date(3) }),
      newTask({ title: "Renew the home insurance", list: "personal", owner: "joint", assignee: "both", project_id: "preview-home", due_date: date(5) }),
      newTask({ title: "Book the photographer", list: "personal", owner: "joint", wedding: true, area_id: "preview-photo", assignee: "both", due_date: date(7) }),
      newTask({ title: "Arrange a venue viewing", list: "personal", owner: "joint", wedding: true, area_id: "preview-venue", assignee: "umit", due_date: date(2) }),
      newTask({ title: "Send the team briefing", status: "done", completed_at: now(), completed_by: "umit", project_id: "preview-operations" }),
    ],
    events: [
      { id: "preview-event", title: "Production catch-up", notes: "Review the floor plan and supplier timelines.", location: "Teams", owner: "umit", added_by: "umit", assignee: null, all_day: false, starts_at: new Date(date(0) + "T14:00:00").toISOString(), ends_at: new Date(date(0) + "T14:30:00").toISOString(), start_date: null, end_date: null, remind_minutes: 30, repeat: null, wedding: false, work: true, shared: false, busy: false, created_at: now(), updated_at: now() },
    ],
    messages: [{ id: "preview-message", name: "Alex Morgan", email: "alex@example.com", company: "Example Events", message: "Sample enquiry: could we discuss production support for our next exhibition?", created_at: now(), read_at: null }],
    us: [
      { id: "preview-shopping", kind: "shopping", title: "Milk", body: null, day: null, emoji: null, owner: "joint", added_by: "umit", list: null, ref: null, yes: null, done: false, done_by: null, for_user: null, created_at: now(), updated_at: now() },
      { id: "preview-countdown", kind: "countdown", title: "Weekend away", body: null, day: date(28), emoji: "✈️", owner: "joint", added_by: "umit", list: null, ref: null, yes: null, done: false, done_by: null, for_user: null, created_at: now(), updated_at: now() },
    ],
    wedding: { plan: { wedding_date: date(180), venue: "Choose your venue", capacity: 120, guests_umit: 60, guests_dilfiraz: 60, budget: 18000 }, areas: [
      { id: "preview-venue", name: "Venue", emoji: "🏛️", position: 0, budget: 8000, spent: 1200 },
      { id: "preview-photo", name: "Photography", emoji: "📷", position: 1, budget: 2000, spent: 0 },
      { id: "preview-food", name: "Catering", emoji: "🍽️", position: 2, budget: 4000, spent: 0 },
      { id: "preview-guests", name: "Guests", emoji: "👥", position: 3, budget: null, spent: null },
    ], guests: [{ id: "preview-guest", side: "umit", name: "Example family", people: 4, added_by: "umit", created_at: now() }] },
  };
}

function load(): State {
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s?.tasks && s?.wedding) return s as State; } catch { /* seed a fresh preview */ }
  const s = seed(); save(s); return s;
}
function save(s: State) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function resetPreview() {
  localStorage.removeItem(KEY);
  for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key?.startsWith("backstage:preview:")) localStorage.removeItem(key); }
  if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase("backstage-preview-files");
}

async function blobStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("backstage-preview-files", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
export async function previewUpload(taskId: string, file: File): Promise<TaskFile> {
  const s = load(); const f: TaskFile = { id: id(), task_id: taskId, name: file.name, mime: file.type, size: file.size, added_by: s.me.id, created_at: now() };
  const db = await blobStore();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put(file, f.id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close(); s.files.push(f); save(s); return f;
}
async function fileLink(fileId: string) {
  const db = await blobStore();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => { const req = db.transaction("files").objectStore("files").get(fileId); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  db.close(); if (!blob) throw new Error("This preview attachment is no longer available. Attach it again.");
  return URL.createObjectURL(blob);
}

export async function previewRequest<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const s = load(), method = init?.method || "GET", body = (init?.body || {}) as Record<string, unknown>;
  const url = new URL(path, "https://preview.invalid"), parts = url.pathname.split("/").filter(Boolean), [resource, key, action] = parts;
  if (resource === "finance") return financePreviewRequest<T>(path, init, s.me.id);
  let result: unknown = {};
  if (resource === "state") result = { ...s, tasks: s.tasks.filter(t => t.owner === s.me.id || t.owner === "joint"), projects: s.projects.filter(p => p.owner === s.me.id || p.owner === "joint"), events: s.events.filter(e => e.owner === s.me.id || e.owner === "joint" || e.shared), messages: s.me.admin ? s.messages : [], us: s.us.filter(x => x.owner === "joint" || x.owner === s.me.id), users: people, chat_unread: 0, scores: [{ who: "umit", this_week: s.tasks.filter(t => t.owner === "joint" && t.completed_by === "umit").length, last_week: 0 }], push_key: "" };
  else if (resource === "login") { s.me = { ...people.find(p => p.id === body.username) || people[0], admin: body.username !== "dilfiraz" }; }
  else if (resource === "logout") { /* preview sessions never authenticate */ }
  else if (resource === "chat") {
    if (key === "read") s.chat.forEach(m => { m.read_at = now(); });
    else if (method === "POST") { const m: ChatMessage = { id: id(), sender: s.me.id, body: String(body.body || ""), kind: body.kind === "heart" ? "heart" : "text", created_at: now(), read_at: null }; s.chat.push(m); result = m; }
    else if (method === "DELETE") s.chat = s.chat.filter(m => m.id !== key);
    else result = { messages: s.chat.filter(m => !url.searchParams.get("after") || m.created_at > url.searchParams.get("after")!), unread: 0, seen_up_to: null };
  }
  else if (resource === "tasks") {
    if (method === "POST" && !key) { const task = newTask({ ...body, owner: body.owner || s.me.id } as Partial<Task>, s.me.id); s.tasks.unshift(task); result = task; }
    else {
      const task = s.tasks.find(t => t.id === key); if (!task) throw new Error("Task not found in this preview.");
      if (action === "nudge") { task.nudges++; result = { nudges: task.nudges }; }
      else if (method === "DELETE") { s.tasks = s.tasks.filter(t => t.id !== key); s.files = s.files.filter(f => f.task_id !== key); }
      else if (method === "PATCH") {
        const completing = body.status === "done" && task.status !== "done";
        Object.assign(task, body, { updated_at: now(), updated_by: s.me.id });
        if (body.status) { task.completed_at = task.status === "done" ? now() : null; task.completed_by = task.status === "done" ? s.me.id : null; }
        let spawned: Task | undefined;
        if (completing && task.repeat && !s.nextTasks?.[task.id]) { spawned = newTask({ ...task, id: id(), due_date: nextOccurrence(task.due_date || date(0), task.repeat), status: "todo", completed_at: null, completed_by: null, created_at: now() }); s.tasks.unshift(spawned); (s.nextTasks ??= {})[task.id] = spawned.id; }
        result = { ...task, ...(spawned ? { spawned } : {}) };
      } else result = task;
    }
  }
  else if (resource === "projects") {
    if (method === "POST") { const p = { id: id(), owner: s.me.id, position: s.projects.length, due_date: null, list: "work", ...body } as Project; s.projects.push(p); result = p; }
    else if (method === "DELETE") { s.projects = s.projects.filter(p => p.id !== key); s.tasks.forEach(t => { if (t.project_id === key) t.project_id = null; }); }
    else { const p = s.projects.find(p => p.id === key); if (!p) throw new Error("Project not found."); Object.assign(p, body); s.tasks.forEach(t => { if (t.project_id === key && t.owner !== "joint") t.list = p.list; }); result = p; }
  }
  else if (resource === "events") {
    if (method === "POST") { const e = { id: id(), owner: s.me.id, added_by: s.me.id, assignee: null, notes: null, location: null, all_day: false, start_date: null, end_date: null, starts_at: null, ends_at: null, repeat: null, remind_minutes: null, wedding: false, work: true, shared: false, busy: false, created_at: now(), updated_at: now(), ...body } as CalEvent; s.events.push(e); result = e; }
    else if (method === "DELETE") s.events = s.events.filter(e => e.id !== key);
    else { const e = s.events.find(e => e.id === key); if (!e) throw new Error("Event not found."); Object.assign(e, body, { updated_at: now() }); result = e; }
  }
  else if (resource === "us") {
    if (method === "POST") {
      const item = { id: id(), title: "", owner: "joint", added_by: s.me.id, body: null, day: ["mood", "vote", "memory"].includes(String(body.kind)) ? date(0) : null, emoji: null, list: null, ref: null, yes: null, done: false, done_by: null, for_user: null, created_at: now(), updated_at: now(), ...body } as UsItem;
      if (item.kind === "gift") { item.owner = s.me.id; item.for_user = s.me.id === "umit" ? "dilfiraz" : "umit"; }
      s.us = s.us.filter(x => !(x.added_by === item.added_by && x.day === item.day && (x.kind === "mood" && item.kind === "mood" || x.kind === "vote" && item.kind === "vote" && (item.ref ? x.ref === item.ref : x.ref === null && x.title === item.title))));
      s.us.push(item); result = item;
    }
    else if (method === "DELETE") {
      const what = url.searchParams.get("what"), game = url.searchParams.get("game");
      const ideaIds = new Set(s.us.filter(x => x.kind === "idea" && x.list === game).map(x => x.id));
      s.us = s.us.filter(x => what === "ticked-shopping" ? !(x.kind === "shopping" && x.done) : what === "my-votes" ? !(x.kind === "vote" && x.added_by === s.me.id && (!game || (x.ref ? ideaIds.has(x.ref) : x.title.startsWith(game === "dinner" ? "dish:" : "date:")))) : x.id !== key && x.ref !== key);
    }
    else { const item = s.us.find(x => x.id === key); if (!item) throw new Error("Item not found."); Object.assign(item, body, { updated_at: now() }); if (item.kind === "shopping" && "done" in body) item.done_by = body.done ? s.me.id : null; result = item; }
  }
  else if (resource === "wedding") {
    if (!key) {
      Object.assign(s.wedding.plan, body);
      for (const name of ["capacity", "guests_umit", "guests_dilfiraz", "budget"] as const) if (name in body) s.wedding.plan[name] = body[name] == null || body[name] === "" ? null : Number(body[name]);
      if (body.wedding_date) {
        let event = s.events.find(e => e.id === s.wedding.plan.event_id);
        if (!event) { event = { id: id(), title: "Our wedding", owner: "joint", added_by: s.me.id, assignee: "both", notes: null, location: s.wedding.plan.venue, all_day: true, starts_at: null, ends_at: null, start_date: String(body.wedding_date), end_date: null, remind_minutes: null, repeat: null, wedding: true, work: false, shared: true, busy: false, created_at: now(), updated_at: now() }; s.events.push(event); s.wedding.plan.event_id = event.id; }
        else { event.start_date = String(body.wedding_date); event.location = s.wedding.plan.venue; }
      }
    }
    else if (key === "areas") {
      if (method === "POST") s.wedding.areas.push({ id: id(), name: String(body.name), emoji: null, position: s.wedding.areas.length, budget: null, spent: null, ...body });
      else if (method === "DELETE") { s.wedding.areas = s.wedding.areas.filter(a => a.id !== action); s.tasks.forEach(t => { if (t.area_id === action) t.area_id = null; }); }
      else Object.assign(s.wedding.areas.find(a => a.id === action) || {}, body);
      s.wedding.areas.forEach(a => { a.budget = a.budget == null ? null : Number(a.budget); a.spent = a.spent == null ? null : Number(a.spent); });
    } else if (key === "guests") {
      if (method === "POST") {
        const lines = (Array.isArray(body.lines) ? body.lines : []).filter((x): x is string => typeof x === "string");
        for (const line of lines) { const g = readGuestLine(line); if (g && !s.wedding.guests.some(x => x.side === body.side && x.name.toLowerCase() === g.name.toLowerCase())) s.wedding.guests.push({ id: id(), side: body.side === "dilfiraz" ? "dilfiraz" : "umit", ...g, added_by: s.me.id, created_at: now() }); }
      }
      else if (method === "DELETE") s.wedding.guests = s.wedding.guests.filter(g => g.id !== action);
      else Object.assign(s.wedding.guests.find(g => g.id === action) || {}, body);
    } else if (key === "starter") {
      for (const area of s.wedding.areas) for (const title of STARTER[area.name] || []) if (!s.tasks.some(t => t.area_id === area.id && t.title === title)) s.tasks.push(newTask({ title, owner: "joint", list: "personal", wedding: true, area_id: area.id }));
    }
    result = s.wedding;
  }
  else if (resource === "files") {
    if (action === "link") result = { url: await fileLink(key) };
    else if (method === "DELETE") s.files = s.files.filter(f => f.id !== key);
    else throw new Error("Open preview attachments from their task.");
  }
  else if (resource === "messages") { if (method === "DELETE") s.messages = s.messages.filter(m => m.id !== key); else { const m = s.messages.find(m => m.id === key); if (m) m.read_at = body.read ? now() : null; } }
  else if (resource === "me") { s.birthdays[s.me.id] = body.birthday as string | null; }
  else throw new Error("This needs the live service. Notifications and video delivery are unavailable in the local preview.");
  if (method !== "GET") save(s);
  return structuredClone(result) as T;
}
