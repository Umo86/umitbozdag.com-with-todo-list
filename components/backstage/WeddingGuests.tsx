"use client";

// The wedding guest lists: one for each of you, side by side, with a running
// total against the places each side has and the venue's capacity. Guests go
// in one line at a time (Enter adds the line), or a whole pasted list at
// once. A line can stand for more than one person: "Ali Demir +1" is two,
// "Kaya family x4" is four. Either of you can add to either list, and every
// line shows who added it.
import { useMemo, useRef, useState } from "react";
import type { Backstage } from "./useBackstage";
import { colorOf, nameOf, type Me, type Person, type UserId, type WeddingGuest } from "./types";

const PEOPLE_MAX = 50;

/** The same reading of a line as the server's, to count and to spot repeats before sending. */
function readLine(line: string): { name: string; people: number } | null {
  let name = line
    .replace(/^\s*(?:[-*•–]|\d{1,4}[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .replace(/[,;.]+$/, "")
    .trim();
  if (!name) return null;
  let people = 1;
  const plus = /\s*\+\s*(\d{1,2})$/.exec(name);
  const times = /(?:\s+[x×]\s*(\d{1,2})|\s*\((\d{1,2})\)|\s+(\d{1,2}))$/i.exec(name);
  if (plus) {
    people = 1 + Number(plus[1]);
    name = name.slice(0, plus.index).trim();
  } else if (times) {
    people = Number(times[1] ?? times[2] ?? times[3]);
    name = name.slice(0, times.index).trim();
  }
  if (!name) return null;
  return { name, people: Math.min(PEOPLE_MAX, Math.max(1, people)) };
}

export const headcount = (list: WeddingGuest[]) => list.reduce((n, g) => n + g.people, 0);

export default function WeddingGuests({ bs, me, users, narrow, onDetails }: { bs: Backstage; me: Me; users: Person[]; narrow: boolean; onDetails: () => void }) {
  const other = users.find((u) => u.id !== me.id);
  const { plan, guests } = bs.wedding;
  const sides: UserId[] = other ? [me.id, other.id] : [me.id];
  const [showing, setShowing] = useState<UserId>(me.id); // on a phone: one list at a time
  const [find, setFind] = useState("");

  // one change at a time, in order: each answer is the whole list, so a
  // slower earlier answer must never land after a later one
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const send = (path: string, method: string, body?: unknown) => {
    const next = queue.current.then(() => bs.weddingCall(`/guests${path}`, method, body));
    queue.current = next.catch(() => {});
    return next;
  };

  const places = (id: UserId) => (id === "umit" ? plan.guests_umit : plan.guests_dilfiraz);
  const bySide = useMemo(() => {
    const m = new Map<UserId, WeddingGuest[]>();
    for (const id of sides) m.set(id, []);
    for (const g of guests) m.get(g.side)?.push(g);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests, me.id, other?.id]);
  const total = headcount(guests);
  const room = plan.capacity ?? (plan.guests_umit != null || plan.guests_dilfiraz != null ? (plan.guests_umit ?? 0) + (plan.guests_dilfiraz ?? 0) : null);
  const whose = (id: UserId) => (id === me.id ? "Your" : `${nameOf(id)}’s`);

  const addLines = (side: UserId, text: string) => {
    const lines = text.split(/\r?\n/).map(readLine).filter((g): g is { name: string; people: number } => !!g);
    if (!lines.length) return;
    const mine = new Set((bySide.get(side) ?? []).map((g) => g.name.toLowerCase()));
    const fresh: typeof lines = [];
    const repeats: string[] = [];
    for (const g of lines) {
      const k = g.name.toLowerCase();
      if (mine.has(k)) repeats.push(g.name);
      else {
        mine.add(k);
        fresh.push(g);
      }
    }
    if (!fresh.length) {
      bs.say(repeats.length === 1 ? `${repeats[0]} is already on ${whose(side).toLowerCase()} list.` : `Those ${repeats.length} are already on ${whose(side).toLowerCase()} list.`, "error");
      return;
    }
    // someone who is on the other list too is worth a word (it still goes on)
    const elsewhere = new Set(guests.filter((g) => g.side !== side).map((g) => g.name.toLowerCase()));
    const both = fresh.filter((g) => elsewhere.has(g.name.toLowerCase()));
    void send("", "POST", { side, lines: fresh.map((g) => (g.people > 1 ? `${g.name} x${g.people}` : g.name)) }).then((ok) => {
      if (!ok) return;
      const n = fresh.reduce((s, g) => s + g.people, 0);
      if (fresh.length > 1 || repeats.length || both.length) {
        bs.say(
          [
            fresh.length > 1 ? `${fresh.length} lines added (${n} ${n === 1 ? "person" : "people"}).` : `${fresh[0].name} added.`,
            repeats.length ? `${repeats.length} already on the list, left out.` : "",
            both.length ? `${both.length === 1 ? both[0].name + " is" : both.length + " are"} on the other list too.` : "",
          ]
            .filter(Boolean)
            .join(" ")
        );
      }
    });
  };

  const remove = (g: WeddingGuest) => {
    void send(`/${g.id}`, "DELETE").then((ok) => {
      if (ok) bs.say(`${g.name} removed.`, "info", { label: "Undo", run: () => void send("", "POST", { side: g.side, lines: [g.people > 1 ? `${g.name} x${g.people}` : g.name] }) });
    });
  };

  const q = find.trim().toLowerCase();

  return (
    <section className="bs-guests" aria-label="Guest lists">
      <div className="bs-guests-sum">
        <p className="tot">
          <strong className={room != null && total > room ? "over" : undefined}>{total}</strong>
          <span>
            {total === 1 ? "guest" : "guests"} in total
            {room != null && (total > room ? ` · ${total - room} more than the ${plan.capacity != null ? "venue holds" : "places you have"} (${room})` : ` · ${room - total} of ${room} places left`)}
          </span>
        </p>
        <div className="tools">
          {guests.length > 8 && <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a name" aria-label="Find a name" />}
          <button className="bs-link" onClick={onDetails}>
            {plan.capacity == null ? "Set the capacity" : "Change capacity and places"}
          </button>
        </div>
      </div>

      {narrow && sides.length > 1 && (
        <div className="bs-seg" role="group" aria-label="Whose list">
          {sides.map((id) => (
            <button key={id} aria-pressed={showing === id} onClick={() => setShowing(id)}>
              {id === me.id ? "Your guests" : `${nameOf(id)}’s`}
              <span className="n">{headcount(bySide.get(id) ?? [])}</span>
            </button>
          ))}
        </div>
      )}

      <div className="bs-guestcols">
        {sides
          .filter((id) => !narrow || sides.length === 1 || id === showing)
          .map((id) => (
            <GuestList
              key={id}
              side={id}
              title={`${whose(id)} guests`}
              list={bySide.get(id) ?? []}
              places={places(id) ?? null}
              find={q}
              me={me}
              otherSide={sides.find((s) => s !== id)}
              onAdd={(text) => addLines(id, text)}
              onPatch={(g, body) => void send(`/${g.id}`, "PATCH", body)}
              onRemove={remove}
            />
          ))}
      </div>
    </section>
  );
}

function GuestList({
  side,
  title,
  list,
  places,
  find,
  me,
  otherSide,
  onAdd,
  onPatch,
  onRemove,
}: {
  side: UserId;
  title: string;
  list: WeddingGuest[];
  places: number | null;
  find: string;
  me: Me;
  otherSide?: UserId;
  onAdd: (text: string) => void;
  onPatch: (g: WeddingGuest, body: { name?: string; people?: number; side?: UserId }) => void;
  onRemove: (g: WeddingGuest) => void;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const people = headcount(list);
  const over = places != null && people > places;
  const shown = find ? list.filter((g) => g.name.toLowerCase().includes(find)) : list;
  const typed = readLine(text);

  return (
    <div className="bs-guestlist" style={{ ["--who" as string]: colorOf(side) }}>
      <div className="head">
        <h3>
          <span className="bs-dot" style={{ background: colorOf(side) }} />
          {title}
        </h3>
        <p className={over ? "over" : undefined}>
          <b>{people}</b>
          {places != null ? ` of ${places} places` : people === 1 ? " person" : " people"}
          {over ? ` · ${people - places!} over` : ""}
          {list.length !== people ? ` · ${list.length} lines` : ""}
        </p>
      </div>
      {places != null && (
        <span className="meter" aria-hidden="true">
          <i className={over ? "over" : undefined} style={{ width: `${Math.min(100, places ? (people / places) * 100 : 100)}%` }} />
        </span>
      )}

      <form
        className="add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAdd(text);
          setText("");
        }}
      >
        <input
          value={text}
          maxLength={160}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            // a pasted list (several lines) goes in as it is, a line per guest
            const pasted = e.clipboardData.getData("text");
            if (!/\r?\n/.test(pasted.trim())) return;
            e.preventDefault();
            onAdd(pasted);
          }}
          placeholder="Add guest names"
          aria-label={`Add a guest to ${title.toLowerCase()}`}
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" className="btn wed" disabled={!text.trim()}>
          Add guest
        </button>
      </form>
      <p className="bs-hint">
        {typed && typed.people > 1
          ? `Adds “${typed.name}” as ${typed.people} people.`
          : "Type a name and press Enter. “Ali Demir +1” counts as 2, “Kaya family x4” as 4. Paste a list of names to add them all at once."}
      </p>

      {shown.length > 0 ? (
        <ol className="rows">
          {shown.map((g) => (
            <li key={g.id}>
              <span className="no">{list.indexOf(g) + 1}</span>
              {editing === g.id ? (
                <input
                  className="nm-edit"
                  autoFocus
                  defaultValue={g.name}
                  maxLength={120}
                  aria-label={`Rename ${g.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.value = g.name;
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.replace(/\s+/g, " ").trim();
                    if (v && v !== g.name) onPatch(g, { name: v });
                    setEditing(null);
                  }}
                />
              ) : (
                <button className="nm" onClick={() => setEditing(g.id)} title="Tap to change the name">
                  <b>{g.name}</b>
                  <small style={{ color: colorOf(g.added_by) }}>Added by {g.added_by === me.id ? "you" : nameOf(g.added_by)}</small>
                </button>
              )}
              <span className="ppl" role="group" aria-label={`People on this line: ${g.people}`}>
                <button aria-label="One fewer" disabled={g.people <= 1} onClick={() => onPatch(g, { people: g.people - 1 })}>
                  −
                </button>
                <b>{g.people}</b>
                <button aria-label="One more" disabled={g.people >= PEOPLE_MAX} onClick={() => onPatch(g, { people: g.people + 1 })}>
                  +
                </button>
              </span>
              {otherSide && (
                <button className="mv" title={`Move to ${otherSide === me.id ? "your" : `${nameOf(otherSide)}’s`} list`} aria-label={`Move ${g.name} to ${otherSide === me.id ? "your" : `${nameOf(otherSide)}’s`} list`} onClick={() => onPatch(g, { side: otherSide })}>
                  ⇄
                </button>
              )}
              <button className="rm" aria-label={`Remove ${g.name}`} title="Remove" onClick={() => onRemove(g)}>
                ×
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="bs-empty small">{find ? "No one by that name on this list." : "No one on this list yet."}</p>
      )}
    </div>
  );
}
