"use client";

// Add or edit a calendar event. Two questions decide where it lives: which
// calendar (Work, Personal, Joint, Wedding) and who can see it (only you, or
// the other person too). Then: all day or with times, a place, a reminder, a
// repeat. Repeating events change as a whole series. An entry the other
// person shared with you opens to read, not to change.
import { useEffect, useState } from "react";
import { REPEAT_LABEL, REPEATS, ymd, type Repeat } from "@/lib/parse";
import { colorOf, nameOf, type Assignee, type CalEvent, type EventPatch, type Me, type Person, type Space } from "./types";
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

type Cal = "work" | "personal" | "joint" | "wedding";
const CALS: Array<[Cal, string]> = [
  ["work", "Work"],
  ["personal", "Personal"],
  ["joint", "Joint"],
  ["wedding", "💍 Wedding"],
];
const CAL_NAME: Record<Cal, string> = { work: "Work", personal: "Personal", joint: "Joint", wedding: "Wedding" };

const p2 = (n: number) => String(n).padStart(2, "0");
const timeOf = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const plusHour = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${p2(Math.min(23, h + 1))}:${p2(m)}`;
};

export default function EventSheet({
  space,
  bs,
  me,
  users,
  event,
  day,
  preset,
  onClose,
  onSwitchToTask,
}: {
  space: Space; // the side you are on: a new entry starts as a Work or a Personal one
  bs: Backstage;
  me: Me;
  users: Person[];
  event?: CalEvent; // editing
  day?: string; // new event on this day
  preset?: { title: string; time: string; joint?: boolean; wedding?: boolean };
  onClose: () => void;
  onSwitchToTask?: () => void;
}) {
  const start = event?.starts_at ? new Date(event.starts_at) : null;
  const end = event?.ends_at ? new Date(event.ends_at) : null;
  const [title, setTitle] = useState(event?.title ?? preset?.title ?? "");
  // which calendar: an existing entry's own; a new one starts on the side you are on
  const [cal, setCal] = useState<Cal>(
    event
      ? event.wedding
        ? "wedding"
        : event.owner === "joint"
          ? "joint"
          : event.work
            ? "work"
            : "personal"
      : preset?.wedding
        ? "wedding"
        : preset?.joint
          ? "joint"
          : space
  );
  const joint = cal === "joint" || cal === "wedding";
  const wedding = cal === "wedding";
  const work = cal === "work";
  // who can see it: only you, or the other person too (joint entries: always both)
  const [shared, setShared] = useState(event ? !!event.shared : false);
  const onWork = space === "work";
  const theirs = !!event && event.owner !== me.id && event.owner !== "joint"; // shared with you: read only
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
      wedding: joint && wedding,
      work: !joint && work,
      shared: !joint && shared,
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
      bs.say(event ? "Event saved." : `Added to the ${CAL_NAME[cal]} calendar.`);
      onClose();
    }
  };

  if (theirs && event) {
    const whose = nameOf(event.owner);
    const dayFmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const when = event.all_day
      ? `${dayFmt(new Date(`${event.start_date}T00:00:00`))}${event.end_date && event.end_date !== event.start_date ? ` to ${dayFmt(new Date(`${event.end_date}T00:00:00`))}` : ""} · all day`
      : start
        ? `${dayFmt(start)} · ${timeOf(start)}${end ? ` to ${timeOf(end)}` : ""}`
        : "";
    return (
      <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bs-drawer bs-sheet" role="dialog" aria-modal="true" aria-labelledby="ev-h">
          <div className="bs-grab" aria-hidden="true" />
          <div className="bs-drawer-head">
            <h2 id="ev-h">{whose}&rsquo;s event</h2>
            <button type="button" className="bs-x" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <p className="bs-byline">
            <span className="bs-dot" style={{ background: colorOf(event.owner) }} />
            On {whose}&rsquo;s calendar, shared with you. Only {whose} can change it.
          </p>
          <dl className="bs-ro">
            <dt>Event</dt>
            <dd className="big">{event.title}</dd>
            <dt>When</dt>
            <dd>
              {when}
              {event.repeat ? ` · ${REPEAT_LABEL[event.repeat].toLowerCase()}` : ""}
            </dd>
            {event.location && (
              <>
                <dt>Where</dt>
                <dd>{event.location}</dd>
              </>
            )}
            {event.notes && (
              <>
                <dt>Notes</dt>
                <dd className="pre">{event.notes}</dd>
              </>
            )}
          </dl>
          <div className="bs-drawer-foot">
            <span />
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <input id="ev-title" value={title} maxLength={300} required autoFocus={!event} onChange={(e) => setTitle(e.target.value)} placeholder={onWork ? "e.g. Site visit, ExCeL" : "e.g. Dinner at Mangal"} />

        <label htmlFor={onWork ? "ev-cal" : undefined}>Calendar</label>
        {onWork ? (
          // on the Work side the other calendars stay tucked inside the list
          <select id="ev-cal" value={cal} onChange={(e) => setCal(e.target.value as Cal)}>
            {CALS.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <div className="bs-seg four" role="group" aria-label="Calendar">
            {CALS.map(([id, name]) => (
              <button type="button" key={id} className={id === "wedding" ? "wed" : undefined} aria-pressed={cal === id} onClick={() => setCal(id)}>
                {name}
              </button>
            ))}
          </div>
        )}

        <label>Who can see it</label>
        {joint ? (
          <>
            <div className="bs-seg" role="group" aria-label="Who can see it">
              <button type="button" aria-pressed="true" disabled>
                Both of you
              </button>
            </div>
            <label>Who it&rsquo;s for</label>
            <div className="bs-seg small" role="group" aria-label="Who it's for">
              {(["both", me.id, other?.id].filter(Boolean) as Assignee[]).map((a) => (
                <button type="button" key={a} aria-pressed={assignee === a} onClick={() => setAssignee(a)}>
                  {a === "both" ? "Both of us" : a === me.id ? "Me" : nameOf(a)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="bs-seg" role="group" aria-label="Who can see it">
            <button type="button" aria-pressed={!shared} onClick={() => setShared(false)}>
              Only me
            </button>
            <button type="button" aria-pressed={shared} onClick={() => setShared(true)}>
              {onWork || !other ? "Me and my partner" : `Me and ${other.name}`}
            </button>
          </div>
        )}
        <p className="bs-hint">
          {wedding
            ? "A wedding date: on the joint calendar, in the wedding colour. You both see it and can both change it."
            : joint
              ? "The joint calendar: you both see it and can both change it."
              : `Your ${work ? "work" : "personal"} calendar. ${
                  shared
                    ? `${onWork || !other ? "Your partner" : other.name} can see it too, but only you can change it.`
                    : "Only you can see it."
                }${work && !onWork ? " It shows on the Work side." : !work && onWork ? " It won’t show on the Work side." : ""}`}
        </p>

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
