export type Status = "todo" | "doing" | "done";
export type ListName = "personal" | "work";
export type Priority = "low" | "normal" | "high";
export type UserId = "umit" | "dilfiraz";
export type Owner = UserId | "joint";
export type Assignee = UserId | "both";
export type Person = { id: UserId; name: string; color: string };
export type Me = Person & { admin: boolean };
import type { Repeat } from "@/lib/parse";
export type { Repeat };

export type Project = {
  id: string;
  name: string;
  color: string;
  position: number;
  due_date: string | null; // YYYY-MM-DD
  owner: Owner;
};

export type Task = {
  id: string;
  project_id: string | null;
  list: ListName;
  title: string;
  notes: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null; // YYYY-MM-DD
  remind_at: string | null; // ISO, UTC
  added_by: string;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  repeat: Repeat | null;
  owner: Owner;
  assignee: Assignee | null;
  love_note: string | null;
  completed_by: UserId | null;
  nudges: number;
};

export type CalEvent = {
  id: string;
  owner: Owner;
  assignee: Assignee | null;
  added_by: UserId;
  title: string;
  notes: string | null;
  location: string | null;
  all_day: boolean;
  starts_at: string | null; // ISO
  ends_at: string | null;
  start_date: string | null; // YYYY-MM-DD (all-day)
  end_date: string | null; // inclusive
  remind_minutes: number | null;
  repeat: Repeat | null;
  busy: boolean; // the other person's private event: only the time is known
  created_at: string;
  updated_at: string;
};

export type EventPatch = Partial<
  Pick<CalEvent, "title" | "notes" | "location" | "all_day" | "starts_at" | "ends_at" | "start_date" | "end_date" | "remind_minutes" | "repeat" | "owner" | "assignee">
>;

export type Message = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  created_at: string;
  read_at: string | null;
};

export type TaskPatch = Partial<
  Pick<
    Task,
    "title" | "notes" | "status" | "priority" | "due_date" | "remind_at" | "project_id" | "list" | "position" | "repeat" | "owner" | "assignee" | "love_note"
  >
>;

export const STATUSES: Array<{ id: Status; label: string }> = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

export const SWATCHES = ["#1a47ff", "#d64553", "#1f6f6b", "#b3741f", "#6d3b8e", "#6b7280"];

export function fmtDay(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isOverdue(d: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(d + "T00:00:00") < today;
}

// <input type="datetime-local"> value ⇄ ISO string, in the browser's own zone.
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// ——— people ———
export const PEOPLE: Record<UserId, { name: string; color: string; soft: string }> = {
  umit: { name: "Umit", color: "#1a47ff", soft: "#e8edff" },
  dilfiraz: { name: "Dilfiraz", color: "#e0457b", soft: "#fde8ef" },
};
export const BUSY = { color: "#9aa1b2", soft: "#eef0f4" };
/** Colour for something, by who added it. */
export const colorOf = (addedBy: string) => PEOPLE[addedBy as UserId]?.color ?? "#6b7280";
export const softOf = (addedBy: string) => PEOPLE[addedBy as UserId]?.soft ?? "#f1f2f6";
export const nameOf = (id: string) => PEOPLE[id as UserId]?.name ?? id;
export function assigneeLabel(a: Assignee | null, me: UserId): string | null {
  if (!a) return null;
  if (a === "both") return "Both";
  return a === me ? "You" : nameOf(a);
}
/** A joint item is "for me" when it's assigned to me or to both (or no one). */
export const forMe = (owner: Owner, assignee: Assignee | null, me: UserId) =>
  owner === me || (owner === "joint" && (!assignee || assignee === "both" || assignee === me));

export type ChatMessage = {
  id: string;
  sender: UserId;
  body: string;
  kind: "text" | "heart" | "nudge";
  created_at: string;
  read_at: string | null;
  pending?: boolean; // still sending
  failed?: boolean; // didn't send
};

export type UsKind = "countdown" | "memory" | "idea" | "shopping" | "gift" | "mood" | "vote";
export type UsItem = {
  id: string;
  kind: UsKind;
  owner: string;
  added_by: UserId;
  title: string;
  body: string | null;
  day: string | null;
  emoji: string | null;
  list: "date" | "dinner" | null;
  ref: string | null;
  yes: boolean | null;
  done: boolean;
  done_by: UserId | null;
  for_user: UserId | null;
  created_at: string;
  updated_at: string;
};
export type Score = { who: UserId; this_week: number; last_week: number };
