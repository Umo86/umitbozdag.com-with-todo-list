import type { Task } from "./types";

// Builds a calendar file for one task so the reminder can live in the
// phone's or computer's own calendar (which can alert when Backstage is shut).
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

export function taskToIcs(task: Task): string | null {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//umitbozdag.com//Backstage//EN",
    "BEGIN:VEVENT",
    `UID:${task.id}@umitbozdag.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `SUMMARY:${esc(task.title)}`,
  ];
  if (task.notes) lines.push(`DESCRIPTION:${esc(task.notes)}`);
  if (task.remind_at) {
    const start = new Date(task.remind_at);
    lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 30 * 60000))}`);
  } else if (task.due_date) {
    const day = task.due_date.replace(/-/g, "");
    const next = new Date(task.due_date + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`
    );
  } else {
    return null;
  }
  lines.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(task.title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  );
  return lines.join("\r\n");
}

export function downloadIcs(task: Task): boolean {
  const ics = taskToIcs(task);
  if (!ics) return false;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${task.title.slice(0, 40).replace(/[^\w -]+/g, "").trim() || "task"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
