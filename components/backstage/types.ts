export type Status = "todo" | "doing" | "done";
export type ListName = "personal" | "work";
export type Priority = "low" | "normal" | "high";
export type Role = "owner" | "helper";
import type { Repeat } from "@/lib/parse";
export type { Repeat };

export type Project = {
  id: string;
  name: string;
  color: string;
  position: number;
  due_date: string | null; // YYYY-MM-DD
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
};

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
    "title" | "notes" | "status" | "priority" | "due_date" | "remind_at" | "project_id" | "list" | "position" | "repeat"
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
