"use client";

// Add or edit a calendar event: yours or joint, all day or with times,
// a place, a reminder, a repeat. Repeating events change as a whole series.
import { useEffect, useState } from "react";
import { REPEAT_LABEL, REPEATS, ymd, type Repeat } from "@/lib/parse";
import { colorOf, nameOf, type Assignee, type CalEvent, type EventPatch, type Me, type Person } from "./types";
import type { Backstage } from "./useBackstage";

const REMINDERS: Array<[number | null, string]> = [
  [null, "No reminder"],
  [0, "At the start"],
  [10, "10 minutes before"],
  [30, "30 minutes before"],
  [60, "1 hour before"],
  [120, "2 hours before"],
  [1440, "1 day before"],
  [2880, "2 days before"],
  [10080, "1 week before"],
];

const p2 = (n: number) => String(n).padStart(2, "0");
const timeOf = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const plusHour = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${p2(Math.min(23, h + 1))}:${p2(m)}`;
};

export default function EventSheet({
  bs,
  me,
  users,
  event,
  day,
  preset,
  onClose,
  onSwitchToTask,
}: {
  bs: Backstage;
  me: Me;
  users: Person[];
  event?: CalEvent; // editing
  day?: string; // new event on this day
  preset?: { title: string; time: string; joint?: boolean };
  onClose: () => void;
  onSwitchToTask?: () => void;
}) {
  const start = event?.starts_at ? new Date(event.starts_at) : null;
  const end = event?.ends_at ? new Date(event.ends_at) : null;
  const [title, setTitle] = useState(event?.title ?? preset?.title ?? "");
  const [joint, setJoint] = useState(event ? event.owner === "joint" : preset?.joint ?? false);
  const [assignee, setAssignee] = useState<Assignee>(event?.assignee ?? "both");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [date, setDate] = useState(event?.start_date ?? (start ? ymd(start) : day ?? ymd(new Date())));
  const [endDate, setEndDate] = useState(event?.end_date ?? "");
  const [from, setFrom] = useState(start ? timeOf(start) : preset?.time ?? "09:00");
  const [to, setTo] = useState(end ? timeOf(end) : start ? plusHour(timeOf(start)) : plusHour(preset?.time ?? "09:00"));
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [remind, setRemind] = useState<number | null>(event ? event.remind_minutes : 30);
  const [repeat, setRepeat] = useState<Repeat | "">(event?.repeat ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const other = users.find((u) => u.id !== me.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!title.trim()) return setErr("Give the event a name.");
    const startsAt = new Date(`${date}T${from}`);
    let endsAt = new Date(`${date}T${to}`);
    if (!allDay && endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86_400_000); // past midnight
    const body: EventPatch & { title: string } = {
      title: title.trim(),
      owner: joint ? "joint" : me.id,
      assignee: joint ? assignee : null,
      all_day: allDay,
      start_date: allDay ? date : null,
      end_date: allDay && endDate && endDate > date ? endDate : null,
      starts_at: allDay ? null : startsAt.toISOString(),
      ends_at: allDay ? null : endsAt.toISOString(),
      location: location.trim() || null,
      notes: notes.trim() || null,
      remind_minutes: remind,
      repeat: repeat || null,
    };
    setBusy(true);
    setErr("");
    const ok = event ? await bs.patchEvent(event.id, body) : !!(await bs.addEvent(body));
    setBusy(false);
    if (ok) {
      bs.say(event ? "Event saved." : "Event added.");
      onClose();
    }
  };

  return (
    <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="bs-drawer bs-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ev-h"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="bs-grab" aria-hidden="true" />
        <div className="bs-drawer-head">
          <h2 id="ev-h">{event ? "Event" : "New event"}</h2>
          <button type="button" className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {onSwitchToTask && (
          <div className="bs-seg wide" role="group" aria-label="Add">
            <button type="button" onClick={onSwitchToTask}>
              Task
            </button>
            <button type="button" aria-pressed="true">
              Event
            </button>
          </div>
        )}
        {event && (
          <p className="bs-byline">
            <span className="bs-dot" style={{ background: colorOf(event.added_by) }} />
            Added by {event.added_by === me.id ? "you" : nameOf(event.added_by)}
            {event.repeat ? " · changes apply to every repeat" : ""}
          </p>
        )}

        <label htmlFor="ev-title">Event</label>
        <input id="ev-title" value={title} maxLength={300} required autoFocus={!event} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner at Mangal" />

        <label>Whose</label>
        <div className="bs-seg" role="group" aria-label="Whose calendar">
          <button type="button" aria-pressed={!joint} onClick={() => setJoint(false)}>
            Mine
          </button>
          <button type="button" aria-pressed={joint} onClick={() => setJoint(true)}>
            Joint
          </button>
        </div>
        {joint && (
          <div className="bs-seg small" role="group" aria-label="Who it's for">
            {(["both", me.id, other?.id].filter(Boolean) as Assignee[]).map((a) => (
              <button type="button" key={a} aria-pressed={assignee === a} onClick={() => setAssignee(a)}>
                {a === "both" ? "Both of us" : a === me.id ? "Me" : nameOf(a)}
              </button>
            ))}
          </div>
        )}
        {!joint && other && <p className="bs-hint">{other.name} sees this as &ldquo;Busy&rdquo;, without details.</p>}

        <label className="bs-switch">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>All day</span>
        </label>

        <div className="bs-fields">
          <div>
            <label htmlFor="ev-date">{allDay ? "From" : "Date"}</label>
            <input id="ev-date" type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
          </div>
          {allDay ? (
            <div>
              <label htmlFor="ev-end">Until (optional)</label>
              <input id="ev-end" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          ) : (
            <div className="bs-times">
              <div>
                <label htmlFor="ev-from">Starts</label>
                <input
                  id="ev-from"
                  type="time"
                  value={from}
                  required
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (to <= e.target.value) setTo(plusHour(e.target.value));
                  }}
                />
              </div>
              <div>
                <label htmlFor="ev-to">Ends</label>
                <input id="ev-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="ev-remind">Reminder</label>
            <select id="ev-remind" value={remind ?? ""} onChange={(e) => setRemind(e.target.value === "" ? null : Number(e.target.value))}>
              {REMINDERS.map(([v, l]) => (
                <option key={l} value={v ?? ""}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ev-repeat">Repeat</label>
            <select id="ev-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat | "")}>
              <option value="">Doesn&rsquo;t repeat</option>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {REPEAT_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor="ev-where">Where</label>
        <input id="ev-where" value={location} maxLength={300} onChange={(e) => setLocation(e.target.value)} placeholder="Place or address (optional)" />

        <label htmlFor="ev-notes">Notes</label>
        <textarea id="ev-notes" rows={3} value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} />

        <p className="error-line" role="alert">
          {err}
        </p>
        <div className="bs-drawer-foot">
          {event ? (
            confirm ? (
              <span className="bs-confirm">
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    bs.deleteEvent(event.id);
                    onClose();
                  }}
                >
                  Delete{event.repeat ? " all" : ""}
                </button>
                <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="bs-link danger" onClick={() => setConfirm(true)}>
                Delete…
              </button>
            )
          ) : (
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Saving…" : event ? "Save" : "Add event"}
          </button>
        </div>
      </form>
    </div>
  );
}
