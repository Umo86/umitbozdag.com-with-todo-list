"use client";

// Wedding planning: one shared place for both of you.
// - the day: date and a countdown, the venue
// - guests: a list of names for each of you, counted against the places
//   each side has and the venue's capacity (the Guest list tab)
// - money: the overall budget against what the areas plan and have spent
// - areas (Venue, Catering, Decor… and any you add), each with its own
//   to-dos, budget and spend; pick one to see just its to-dos
// - the to-dos themselves: left with no one, or given to either or both;
//   every one says who added it
import { useEffect, useMemo, useState } from "react";
import { ymd } from "@/lib/parse";
import Board from "./Board";
import TaskList from "./TaskList";
import type { Backstage } from "./useBackstage";
import WeddingGuests, { headcount } from "./WeddingGuests";
import { colorOf, fmtDay, money, nameOf, type Assignee, type CalEvent, type Me, type Person, type Project, type Task, type WeddingArea } from "./types";

const FOR_KEY = "backstage:wedding-for";

const DAY = 86_400_000;
type For = "all" | "none" | "me" | "other";

export default function WeddingView({
  bs,
  me,
  users,
  tasks,
  events,
  projects,
  narrow,
  area,
  setArea,
  tab,
  setTab,
  onOpen,
  onOpenEvent,
  onAdd,
  onNewDate,
}: {
  bs: Backstage;
  me: Me;
  users: Person[];
  tasks: Task[]; // the wedding to-dos
  events: CalEvent[]; // the wedding's calendar entries (appointments, and the day itself)
  projects: Project[];
  narrow: boolean;
  area: string | null; // the area being looked at ("none" = to-dos without one)
  setArea: (id: string | null) => void;
  tab: "plan" | "guests";
  setTab: (t: "plan" | "guests") => void;
  onOpen: (id: string) => void;
  onOpenEvent: (id: string) => void;
  onAdd: (text: string, areaId: string | null, forWho: Assignee | null) => void;
  onNewDate: () => void;
}) {
  const other = users.find((u) => u.id !== me.id);
  const { plan, areas, guests: guestList } = bs.wedding;
  const [who, setWho] = useState<For>("all");
  // who a to-do typed here is for: no one yet, one of you, or both
  const [newFor, setNewForState] = useState<Assignee | null>(null);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(FOR_KEY);
      if (v === "both" || v === "umit" || v === "dilfiraz") setNewForState(v);
    } catch {
      /* fine */
    }
  }, []);
  const setNewFor = (v: Assignee | null) => {
    setNewForState(v);
    try {
      if (v) window.localStorage.setItem(FOR_KEY, v);
      else window.localStorage.removeItem(FOR_KEY);
    } catch {
      /* fine */
    }
  };
  const [sheet, setSheet] = useState<null | { kind: "details" } | { kind: "area"; area: WeddingArea | null }>(null);

  const open = tasks.filter((t) => t.status !== "done");
  const inArea = (t: Task) => (area === null ? true : area === "none" ? !t.area_id || !areas.some((a) => a.id === t.area_id) : t.area_id === area);
  const shown = useMemo(
    () =>
      tasks.filter(inArea).filter((t) =>
        who === "all" ? true : who === "none" ? !t.assignee : who === "me" ? t.assignee === "both" || t.assignee === me.id : t.assignee === "both" || (!!t.assignee && t.assignee !== me.id)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, area, who, me.id, areas]
  );
  const current = area && area !== "none" ? areas.find((a) => a.id === area) : undefined;

  // the day
  const today = ymd(new Date());
  const days = plan.wedding_date ? Math.round((new Date(`${plan.wedding_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / DAY) : null;
  const dateText = plan.wedding_date ? new Date(`${plan.wedding_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : null;

  // guests: the names on each list, against the places each side has
  const mine = headcount(guestList.filter((g) => g.side === me.id));
  const theirs = headcount(guestList.filter((g) => g.side !== me.id));
  const guests = mine + theirs;
  const minePlaces = me.id === "umit" ? plan.guests_umit : plan.guests_dilfiraz;
  const theirPlaces = me.id === "umit" ? plan.guests_dilfiraz : plan.guests_umit;
  const room = plan.capacity ?? (minePlaces != null || theirPlaces != null ? (minePlaces ?? 0) + (theirPlaces ?? 0) : null);
  const over = room != null && guests > room;
  const scale = Math.max(room ?? 0, guests, 1);

  // money
  const planned = areas.reduce((s, a) => s + (a.budget ?? 0), 0);
  const spent = areas.reduce((s, a) => s + (a.spent ?? 0), 0);
  const anyMoney = plan.budget != null || planned > 0 || spent > 0;
  const cap = plan.budget ?? planned;
  const overBudget = plan.budget != null && (planned > plan.budget || spent > plan.budget);

  // what's next: wedding appointments and dated to-dos, soonest first
  const soon = useMemo(() => {
    const items: Array<{ key: string; day: string; time: string | null; title: string; kind: "event" | "task"; id: string; late: boolean }> = [];
    for (const e of events) {
      const day = e.all_day ? e.start_date : e.starts_at ? ymd(new Date(e.starts_at)) : null;
      if (!day || day < today || e.id === plan.event_id) continue; // (the day itself is the countdown above)
      items.push({ key: `e${e.id}`, day, time: e.all_day || !e.starts_at ? null : new Date(e.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), title: e.title, kind: "event", id: e.id, late: false });
    }
    for (const t of tasks) {
      if (t.status === "done" || !t.due_date) continue;
      items.push({ key: `t${t.id}`, day: t.due_date, time: null, title: t.title, kind: "task", id: t.id, late: t.due_date < today });
    }
    return items.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? "")).slice(0, 5);
  }, [events, tasks, today, plan.event_id]);
  // an area that is about the guests or the venue shows those details with it
  const aboutGuests = !!current && /guest/i.test(current.name);
  const aboutVenue = !!current && /venue/i.test(current.name);
  const addWhat = current ? `a ${current.name} to-do` : "a wedding to-do";

  const count = (id: string | "none") => {
    const list = id === "none" ? tasks.filter((t) => !t.area_id || !areas.some((a) => a.id === t.area_id)) : tasks.filter((t) => t.area_id === id);
    return { all: list.length, left: list.filter((t) => t.status !== "done").length };
  };
  const loose = count("none");

  return (
    <div className="bs-wed">
      <section className="bs-wedhero">
        <div className="day">
          <span className="ring" aria-hidden="true">
            💍
          </span>
          {days === null ? (
            <div>
              <h2>Wedding planning</h2>
              <p>Set the date to start the countdown.</p>
            </div>
          ) : (
            <div>
              <h2>
                {days > 1 ? (
                  <>
                    <b>{days}</b> days to go
                  </>
                ) : days === 1 ? (
                  "Tomorrow!"
                ) : days === 0 ? (
                  "Today is the day 🎉"
                ) : (
                  `Married ${-days} day${days === -1 ? "" : "s"} ago 🎉`
                )}
              </h2>
              <p>
                {dateText}
                {plan.venue ? ` · ${plan.venue}` : ""}
                {days > 13 ? ` · ${Math.floor(days / 7)} weeks` : ""}
              </p>
            </div>
          )}
          <button className="btn wed" onClick={() => setSheet({ kind: "details" })}>
            {days === null ? "Set the date" : "Edit details"}
          </button>
        </div>

        <div className="bs-wedstats">
          <button className="stat" onClick={() => setTab("guests")}>
            <span className="k">Guests</span>
            {guests > 0 || room != null ? (
              <>
                <strong className={over ? "over" : undefined}>
                  {guests}
                  <small>{room != null ? ` of ${room} on the lists` : " on the lists"}</small>
                </strong>
                <span className="split" aria-hidden="true">
                  <i className="a" style={{ width: `${(mine / scale) * 100}%`, background: colorOf(me.id) }} />
                  <i className="b" style={{ width: `${(theirs / scale) * 100}%`, background: other ? colorOf(other.id) : undefined }} />
                </span>
                <span className="v">
                  You {mine}
                  {minePlaces != null ? ` of ${minePlaces}` : ""} · {other?.name ?? "Them"} {theirs}
                  {theirPlaces != null ? ` of ${theirPlaces}` : ""}
                  {room != null && over ? ` · ${guests - room} over` : ""}
                </span>
              </>
            ) : (
              <span className="v">Write the guest list for each of you</span>
            )}
          </button>
          <button className="stat" onClick={() => setSheet({ kind: "details" })}>
            <span className="k">Budget</span>
            {anyMoney ? (
              <>
                <strong className={overBudget ? "over" : undefined}>
                  {money(spent)}
                  <small> spent{cap ? ` of ${money(cap)}` : ""}</small>
                </strong>
                <span className="split" aria-hidden="true">
                  <i className="c" style={{ width: `${cap ? Math.min(100, (spent / cap) * 100) : 0}%` }} />
                </span>
                <span className="v">
                  {money(planned)} planned across the areas
                  {plan.budget != null && planned > plan.budget ? ` · ${money(planned - plan.budget)} over budget` : ""}
                </span>
              </>
            ) : (
              <span className="v">Set a budget, then give each area its share</span>
            )}
          </button>
          <div className="stat">
            <span className="k">To-dos</span>
            <strong>
              {tasks.length - open.length}
              <small> of {tasks.length} done</small>
            </strong>
            <span className="split" aria-hidden="true">
              <i className="c" style={{ width: `${tasks.length ? ((tasks.length - open.length) / tasks.length) * 100 : 0}%` }} />
            </span>
            <span className="v">
              {open.filter((t) => !t.assignee).length} with no one yet
              {open.filter((t) => t.due_date && t.due_date < today).length ? ` · ${open.filter((t) => t.due_date && t.due_date < today).length} overdue` : ""}
            </span>
          </div>
        </div>
      </section>

      <div className="bs-seg bs-wedtabs" role="tablist" aria-label="Wedding">
        <button role="tab" aria-selected={tab === "plan"} aria-pressed={tab === "plan"} onClick={() => setTab("plan")}>
          Planning
          <span className="n">{open.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "guests"} aria-pressed={tab === "guests"} onClick={() => setTab("guests")}>
          Guest list
          <span className="n">{guests}</span>
        </button>
      </div>

      {tab === "guests" && <WeddingGuests bs={bs} me={me} users={users} narrow={narrow} onDetails={() => setSheet({ kind: "details" })} />}

      {tab === "plan" && (
        <>
      <section className="bs-wedsoon" aria-label="Coming up">
        <div className="bs-wedareas-head">
          <h3>Coming up</h3>
          <button className="bs-link" onClick={onNewDate}>
            + Add an appointment
          </button>
        </div>
        {soon.length ? (
          <ul>
            {soon.map((it) => (
              <li key={it.key}>
                <button onClick={() => (it.kind === "event" ? onOpenEvent(it.id) : onOpen(it.id))}>
                  <span className={`when${it.late ? " late" : ""}`}>
                    {it.day === today ? "Today" : fmtDay(it.day)}
                    {it.time ? ` · ${it.time}` : ""}
                  </span>
                  <b>{it.title}</b>
                  <small>{it.kind === "event" ? "Appointment" : it.late ? "To-do · overdue" : "To-do"}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet small">Viewings, tastings and fittings you add, and to-dos with a date, show here.</p>
        )}
      </section>

      <div className="bs-wedareas-head">
        <h3>Areas</h3>
      </div>
      <ul className="bs-wedareas">
        <li>
          <button className={`area all${area === null ? " on" : ""}`} aria-pressed={area === null} onClick={() => setArea(null)}>
            <span className="e">💍</span>
            <strong>Everything</strong>
            <small>
              {open.length} to do · {tasks.length - open.length} done
            </small>
          </button>
        </li>
        {areas.map((a) => {
          const c = count(a.id);
          return (
            <li key={a.id}>
              <button className={`area${area === a.id ? " on" : ""}`} aria-pressed={area === a.id} onClick={() => setArea(area === a.id ? null : a.id)}>
                <span className="e">{a.emoji ?? "•"}</span>
                <strong>{a.name}</strong>
                <small>{c.all ? `${c.left} to do · ${c.all - c.left} done` : "Nothing yet"}</small>
                {(a.budget != null || a.spent != null) && (
                  <small className={`m${a.budget != null && (a.spent ?? 0) > a.budget ? " over" : ""}`}>
                    {money(a.spent ?? 0)}
                    {a.budget != null ? ` of ${money(a.budget)}` : " spent"}
                  </small>
                )}
              </button>
              <button className="edit" aria-label={`Edit ${a.name}`} title="Rename, budget, remove" onClick={() => setSheet({ kind: "area", area: a })}>
                ✎
              </button>
            </li>
          );
        })}
        {loose.all > 0 && (
          <li>
            <button className={`area${area === "none" ? " on" : ""}`} aria-pressed={area === "none"} onClick={() => setArea(area === "none" ? null : "none")}>
              <span className="e">📌</span>
              <strong>No area</strong>
              <small>
                {loose.left} to do · {loose.all - loose.left} done
              </small>
            </button>
          </li>
        )}
        <li>
          <button className="area add" onClick={() => setSheet({ kind: "area", area: null })}>
            <span className="e">＋</span>
            <strong>Add an area</strong>
            <small>Cake, favours, henna night…</small>
          </button>
        </li>
      </ul>

      {current && (
        <div className="bs-wedarea-strip">
          <span className="e" aria-hidden="true">
            {current.emoji ?? "•"}
          </span>
          <div className="t">
            <strong>{current.name}</strong>
            <span>
              {current.budget != null || current.spent != null
                ? `${money(current.spent ?? 0)} spent${current.budget != null ? ` of ${money(current.budget)}` : ""}`
                : "No budget set for this area yet"}
              {aboutGuests ? ` · ${guests} ${guests === 1 ? "guest" : "guests"} on the lists${room != null ? ` of ${room} places` : ""}` : ""}
              {aboutVenue ? ` · ${plan.venue ?? "No venue chosen yet"}${plan.capacity != null ? `, holds ${plan.capacity}` : ""}` : ""}
            </span>
          </div>
          {aboutGuests && (
            <button className="btn wed" onClick={() => setTab("guests")}>
              Add guests
            </button>
          )}
          {aboutVenue && (
            <button className="btn wed" onClick={() => setSheet({ kind: "details" })}>
              {plan.venue ? "Venue details" : "Add the venue"}
            </button>
          )}
          <button className="btn ghost" onClick={() => setSheet({ kind: "area", area: current })}>
            Budget &amp; name
          </button>
        </div>
      )}

      <div className="bs-bar bs-wedbar">
        <h3 className="bs-wedlist-h">
          {current ? `${current.name} to-dos` : area === "none" ? "To-dos with no area" : "All wedding to-dos"}
          <span className="n">{shown.filter((t) => t.status !== "done").length}</span>
        </h3>
        <div className="bs-seg small" role="group" aria-label="Show">
          <button aria-pressed={who === "all"} onClick={() => setWho("all")}>
            Everyone
          </button>
          <button aria-pressed={who === "none"} onClick={() => setWho("none")}>
            No one yet
          </button>
          <button aria-pressed={who === "me"} onClick={() => setWho("me")}>
            For me
          </button>
          {other && (
            <button aria-pressed={who === "other"} onClick={() => setWho("other")}>
              For {other.name}
            </button>
          )}
        </div>
      </div>
      {tasks.length < 4 && areas.length > 0 && (
        <p className="bs-wedstart">
          Not sure where to begin?{" "}
          <button
            className="bs-link"
            onClick={async () => {
              if (await bs.weddingCall("/starter", "POST")) {
                await bs.refresh();
                bs.say("Added the usual to-dos to each area. Delete any you don't need.");
              }
            }}
          >
            Add the usual to-dos for each area
          </button>
        </p>
      )}
      <div className="bs-wedfor">
        <span>{current ? `A ${current.name} to-do you add here is for` : "A to-do you add here is for"}</span>
        <div className="bs-seg small" role="group" aria-label="Who a new to-do is for">
          <button aria-pressed={newFor === null} onClick={() => setNewFor(null)}>
            No one yet
          </button>
          <button aria-pressed={newFor === me.id} onClick={() => setNewFor(me.id)}>
            Me
          </button>
          {other && (
            <button aria-pressed={newFor === other.id} onClick={() => setNewFor(other.id)}>
              {other.name}
            </button>
          )}
          <button aria-pressed={newFor === "both"} onClick={() => setNewFor("both")}>
            Both of us
          </button>
        </div>
      </div>
      {narrow ? (
        <TaskList
          tasks={shown}
          projects={projects}
          me={me.id}
          onOpen={onOpen}
          onPatch={bs.patchTask}
          onDelete={bs.deleteTask}
          onAdd={(t) => onAdd(t, current?.id ?? null, newFor)}
          placeholder={`Add ${addWhat}…`}
        />
      ) : (
        <Board key={`wedding-${area ?? "all"}`} addWhat={addWhat} tasks={shown} projects={projects} canEdit onAdd={(t) => onAdd(t, current?.id ?? null, newFor)} onPatch={bs.patchTask} onDelete={bs.deleteTask} onOpen={onOpen} />
      )}
        </>
      )}

      {sheet?.kind === "details" && <DetailsSheet bs={bs} me={me} otherName={other?.name ?? nameOf(me.id === "umit" ? "dilfiraz" : "umit")} onClose={() => setSheet(null)} />}
      {sheet?.kind === "area" && (
        <AreaSheet
          bs={bs}
          area={sheet.area}
          tasks={sheet.area ? count(sheet.area.id).all : 0}
          onClose={() => setSheet(null)}
          onGone={() => {
            if (sheet.area && area === sheet.area.id) setArea(null);
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
const numOrNull = (v: FormDataEntryValue | null) => (String(v ?? "").trim() === "" ? null : String(v).trim());

// ——— the day, the guests, the budget ———
function DetailsSheet({ bs, me, otherName, onClose }: { bs: Backstage; me: Me; otherName: string; onClose: () => void }) {
  useEscape(onClose);
  const { plan } = bs.wedding;
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState(plan.capacity?.toString() ?? "");
  const [gu, setGu] = useState(plan.guests_umit?.toString() ?? "");
  const [gd, setGd] = useState(plan.guests_dilfiraz?.toString() ?? "");
  const total = (Number(gu) || 0) + (Number(gd) || 0);
  const left = cap.trim() === "" ? null : Number(cap) - total;
  const label = (id: "umit" | "dilfiraz") => (me.id === id ? "Places for you" : `Places for ${otherName}`);
  const named = headcount(bs.wedding.guests);
  return (
    <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="bs-drawer bs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Wedding details"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          const ok = await bs.weddingCall("", "PATCH", {
            wedding_date: numOrNull(f.get("date")),
            venue: numOrNull(f.get("venue")),
            capacity: numOrNull(f.get("capacity")),
            guests_umit: numOrNull(f.get("guests_umit")),
            guests_dilfiraz: numOrNull(f.get("guests_dilfiraz")),
            budget: numOrNull(f.get("budget")),
          });
          setBusy(false);
          if (ok) {
            void bs.refresh(); // the day itself is on the joint calendar
            bs.say("Wedding details saved.");
            onClose();
          }
        }}
      >
        <div className="bs-grab" aria-hidden="true" />
        <div className="bs-drawer-head">
          <h2>Wedding details</h2>
          <button type="button" className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="bs-fields">
          <div>
            <label htmlFor="w-date">Wedding date</label>
            <input id="w-date" name="date" type="date" defaultValue={plan.wedding_date ?? ""} />
          </div>
          <div>
            <label htmlFor="w-venue">Venue</label>
            <input id="w-venue" name="venue" maxLength={200} defaultValue={plan.venue ?? ""} placeholder="Where it's happening" />
          </div>
        </div>
        <p className="bs-hint">The date starts the countdown and puts &ldquo;Our wedding&rdquo; on the joint calendar.</p>

        <h3 className="bs-sub">Capacity</h3>
        <div className="bs-fields three">
          <div>
            <label htmlFor="w-cap">Venue holds</label>
            <input id="w-cap" name="capacity" type="number" inputMode="numeric" min={0} step={1} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="e.g. 150" />
          </div>
          <div>
            <label htmlFor="w-gu">{label("umit")}</label>
            <input id="w-gu" name="guests_umit" type="number" inputMode="numeric" min={0} step={1} value={gu} onChange={(e) => setGu(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label htmlFor="w-gd">{label("dilfiraz")}</label>
            <input id="w-gd" name="guests_dilfiraz" type="number" inputMode="numeric" min={0} step={1} value={gd} onChange={(e) => setGd(e.target.value)} placeholder="0" />
          </div>
        </div>
        <p className={`bs-hint${left !== null && left < 0 ? " bad" : ""}`}>
          {total} places shared out.{" "}
          {left === null ? "Add the venue's capacity to see how many are left to share." : left < 0 ? `${-left} more than the venue holds.` : left === 0 ? "That is every place in the venue." : `${left} not given to either side yet.`}{" "}
          {named} {named === 1 ? "guest is" : "guests are"} on the lists so far (the Guest list tab).
        </p>

        <h3 className="bs-sub">Budget</h3>
        <label htmlFor="w-budget">Overall budget (£)</label>
        <input id="w-budget" name="budget" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={plan.budget ?? ""} placeholder="e.g. 20000" />
        <p className="bs-hint">Give each area its share, and note what you&rsquo;ve spent, with the ✎ on the area.</p>

        <div className="bs-drawer-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn wed" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ——— one area: its name, its budget, what's been spent ———
function AreaSheet({ bs, area, tasks, onClose, onGone }: { bs: Backstage; area: WeddingArea | null; tasks: number; onClose: () => void; onGone: () => void }) {
  useEscape(onClose);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  return (
    <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="bs-drawer bs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={area ? `Edit ${area.name}` : "Add an area"}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const body = { name: String(f.get("name") ?? "").trim(), emoji: numOrNull(f.get("emoji")), budget: numOrNull(f.get("budget")), ...(area ? { spent: numOrNull(f.get("spent")) } : {}) };
          if (!body.name) return;
          setBusy(true);
          const ok = area ? await bs.weddingCall(`/areas/${area.id}`, "PATCH", body) : await bs.weddingCall("/areas", "POST", body);
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <div className="bs-grab" aria-hidden="true" />
        <div className="bs-drawer-head">
          <h2>{area ? "Edit area" : "Add an area"}</h2>
          <button type="button" className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {area?.added_by && (
          <p className="bs-byline">
            <span className="bs-dot" style={{ background: colorOf(area.added_by) }} />
            Added by {nameOf(area.added_by)}
          </p>
        )}
        <div className="bs-fields emoji-name">
          <div>
            <label htmlFor="a-emoji">Icon</label>
            <input id="a-emoji" name="emoji" maxLength={8} defaultValue={area?.emoji ?? ""} placeholder="🎂" />
          </div>
          <div>
            <label htmlFor="a-name">Name</label>
            <input id="a-name" name="name" maxLength={60} required autoFocus={!area} defaultValue={area?.name ?? ""} placeholder="e.g. Cake" />
          </div>
        </div>
        <div className="bs-fields">
          <div>
            <label htmlFor="a-budget">Budget (£)</label>
            <input id="a-budget" name="budget" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={area?.budget ?? ""} placeholder="What you plan to spend" />
          </div>
          {area && (
            <div>
              <label htmlFor="a-spent">Spent so far (£)</label>
              <input id="a-spent" name="spent" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={area.spent ?? ""} placeholder="Deposits and payments" />
            </div>
          )}
        </div>
        <div className="bs-drawer-foot bs-edit-foot">
          {area &&
            (sure ? (
              <button
                type="button"
                className="btn danger-o"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await bs.weddingCall(`/areas/${area.id}`, "DELETE");
                  setBusy(false);
                  if (ok) {
                    void bs.refresh();
                    onGone();
                  }
                }}
              >
                Yes, remove {area.name}
              </button>
            ) : (
              <button type="button" className="btn danger-o" onClick={() => setSure(true)}>
                Remove
              </button>
            ))}
          <button type="submit" className="btn wed" disabled={busy}>
            {busy ? "Saving…" : area ? "Save" : "Add area"}
          </button>
        </div>
        {area && sure && <p className="bs-hint">{tasks ? `Its ${tasks} to-do${tasks === 1 ? " is" : "s are"} kept, under “No area”.` : "It has no to-dos."}</p>}
      </form>
    </div>
  );
}
