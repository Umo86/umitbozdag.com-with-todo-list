import { cleanAssignee, cleanOwner, cleanRepeat, cleanTitle, cleanWhen, DATE, JOINT } from "./backstage";
import type { Me } from "./auth";

// Checks an event's fields from a request. `partial` allows leaving fields
// out (an edit); a new event needs a title and a time.
export type EventFields = Record<string, unknown>;

export function readEvent(body: Record<string, unknown>, me: Me, partial: boolean):
  | { ok: true; fields: EventFields }
  | { ok: false; error: string } {
  const f: EventFields = {};
  const has = (k: string) => body[k] !== undefined;

  if (!partial || has("title")) {
    const t = cleanTitle(body.title, 300);
    if (!t) return { ok: false, error: "An event needs a title." };
    f.title = t;
  }
  if (!partial || has("owner")) {
    const o = cleanOwner(body.owner, me);
    if (!o) return { ok: false, error: "An event is yours or joint." };
    f.owner = o;
    if (o !== JOINT) f.assignee = null;
  }
  if (has("assignee")) f.assignee = cleanAssignee(body.assignee);
  if (has("notes")) f.notes = typeof body.notes === "string" ? body.notes.slice(0, 4000) || null : null;
  if (has("location")) f.location = typeof body.location === "string" ? body.location.slice(0, 300) || null : null;
  if (has("repeat")) {
    if (body.repeat !== null && !cleanRepeat(body.repeat)) return { ok: false, error: "Unknown repeat." };
    f.repeat = cleanRepeat(body.repeat);
  }
  if (has("remind_minutes")) {
    const m = body.remind_minutes;
    if (m === null) f.remind_minutes = null;
    else if (typeof m === "number" && Number.isInteger(m) && m >= 0 && m <= 60 * 24 * 14) f.remind_minutes = m;
    else return { ok: false, error: "A reminder is a number of minutes before." };
  }

  const timing = ["all_day", "starts_at", "ends_at", "start_date", "end_date"].some(has);
  if (!partial || timing) {
    const allDay = body.all_day === true;
    f.all_day = allDay;
    if (allDay) {
      const sd = typeof body.start_date === "string" && DATE.test(body.start_date) ? body.start_date : null;
      const ed = typeof body.end_date === "string" && DATE.test(body.end_date) ? body.end_date : null;
      if (!sd) return { ok: false, error: "An all-day event needs a date." };
      if (ed && ed < sd) return { ok: false, error: "It can't end before it starts." };
      Object.assign(f, { start_date: sd, end_date: ed, starts_at: null, ends_at: null });
    } else {
      const s = cleanWhen(body.starts_at);
      const e = body.ends_at === null || body.ends_at === undefined ? null : cleanWhen(body.ends_at);
      if (!s) return { ok: false, error: "An event needs a start date and time." };
      if (body.ends_at && !e) return { ok: false, error: "That end time isn't valid." };
      if (e && e < s) return { ok: false, error: "It can't end before it starts." };
      Object.assign(f, { starts_at: s, ends_at: e, start_date: null, end_date: null });
    }
  }
  return { ok: true, fields: f };
}
