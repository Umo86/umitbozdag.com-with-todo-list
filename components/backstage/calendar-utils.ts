// Turns events (some repeating, some spanning days), due tasks and project
// deadlines into "what's on each day", in the device's own time zone.
import { ymd } from "@/lib/parse";
import type { CalEvent, Project, Repeat, Task } from "./types";

export type DayItem = {
  key: string;
  kind: "event" | "task" | "deadline";
  day: string; // YYYY-MM-DD
  start: Date | null; // timed events
  end: Date | null;
  allDay: boolean;
  title: string;
  event?: CalEvent;
  task?: Task;
  project?: Project;
};

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), last));
  return r;
}
function step(d: Date, repeat: Repeat, k: number): Date {
  switch (repeat) {
    case "daily":
      return addDays(d, k);
    case "weekly":
      return addDays(d, 7 * k);
    case "fortnightly":
      return addDays(d, 14 * k);
    case "monthly":
      return addMonths(d, k);
    case "yearly":
      return addMonths(d, 12 * k);
    case "weekdays": {
      // k weekdays on from d
      let r = d;
      let left = k;
      while (left > 0) {
        r = addDays(r, 1);
        if (r.getDay() !== 0 && r.getDay() !== 6) left--;
      }
      return r;
    }
  }
}
export const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Each time an event happens between two days (inclusive). */
export function occurrences(e: CalEvent, from: string, to: string): DayItem[] {
  const out: DayItem[] = [];
  const toEnd = parseDay(to);
  toEnd.setHours(23, 59, 59);
  const fromStart = parseDay(from);
  let base: Date;
  let lengthDays = 0;
  let durMs = 0;
  if (e.all_day) {
    if (!e.start_date) return out;
    base = parseDay(e.start_date);
    lengthDays = e.end_date ? Math.max(0, Math.round((parseDay(e.end_date).getTime() - base.getTime()) / 86_400_000)) : 0;
  } else {
    if (!e.starts_at) return out;
    base = new Date(e.starts_at);
    durMs = e.ends_at ? Math.max(0, new Date(e.ends_at).getTime() - base.getTime()) : 60 * 60_000;
  }
  for (let k = 0; k < 2000; k++) {
    const start = k === 0 ? base : e.repeat ? step(base, e.repeat, k) : null;
    if (!start || start > toEnd) break;
    if (e.all_day) {
      for (let i = 0; i <= lengthDays; i++) {
        const d = addDays(start, i);
        if (d >= fromStart && d <= toEnd) {
          out.push({ key: `${e.id}|${ymd(d)}`, kind: "event", day: ymd(d), start: null, end: null, allDay: true, title: e.title, event: e });
        }
      }
    } else {
      const end = new Date(start.getTime() + durMs);
      if (end >= fromStart) {
        out.push({ key: `${e.id}|${start.toISOString()}`, kind: "event", day: ymd(start), start, end, allDay: false, title: e.title, event: e });
      }
    }
    if (!e.repeat) break;
  }
  return out;
}

/** Everything on the calendar between two days, grouped by day. */
export function itemsByDay(
  from: string,
  to: string,
  events: CalEvent[],
  tasks: Task[],
  projects: Project[]
): Map<string, DayItem[]> {
  const map = new Map<string, DayItem[]>();
  const put = (it: DayItem) => {
    const list = map.get(it.day) ?? [];
    list.push(it);
    map.set(it.day, list);
  };
  for (const e of events) occurrences(e, from, to).forEach(put);
  for (const t of tasks) {
    if (t.status === "done" || !t.due_date || t.due_date < from || t.due_date > to) continue;
    put({ key: `t|${t.id}`, kind: "task", day: t.due_date, start: null, end: null, allDay: true, title: t.title, task: t });
  }
  for (const p of projects) {
    if (!p.due_date || p.due_date < from || p.due_date > to) continue;
    put({ key: `p|${p.id}`, kind: "deadline", day: p.due_date, start: null, end: null, allDay: true, title: `${p.name} deadline`, project: p });
  }
  const rank = (i: DayItem) => (i.kind === "deadline" ? 0 : i.allDay && i.kind === "event" ? 1 : i.kind === "task" ? 3 : 2);
  for (const list of map.values()) {
    list.sort((a, b) => rank(a) - rank(b) || (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
  }
  return map;
}

export const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
