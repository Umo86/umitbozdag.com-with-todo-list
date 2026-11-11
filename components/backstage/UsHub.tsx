"use client";

// The "Us" tab: chat, plus the things just for the two of you: what's for
// dinner and date night (both: swipe until you match), the memory jar and a
// private gift-ideas list.
import { useMemo, useRef, useState } from "react";
import { DATES, DISHES, GAME_PREFIX, shuffleForDay, type Game } from "@/lib/dishes";
import { ymd } from "@/lib/parse";
import Chat from "./Chat";
import { Confetti, nextYearly } from "./Fun";
import { colorOf, nameOf, softOf, type Me, type Person, type UsItem } from "./types";
import type { Backstage } from "./useBackstage";

export type UsSection = "chat" | "dinner" | "dates" | "memories" | "gifts";
const SECTIONS: Array<[UsSection, string]> = [
  ["chat", "💬 Chat"],
  ["dinner", "🍽️ Dinner"],
  ["dates", "💘 Dates"],
  ["memories", "📸 Memories"],
  ["gifts", "🎁 Gifts"],
];

export default function UsHub({
  bs,
  me,
  users,
  section,
  onSection,
  onPlan,
}: {
  bs: Backstage;
  me: Me;
  users: Person[];
  section: UsSection;
  onSection: (s: UsSection) => void;
  onPlan: (title: string, day: string, time: string) => void;
}) {
  return (
    <div className="bs-us">
      <div className="bs-us-tabs" role="tablist" aria-label="Us">
        {SECTIONS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={section === id} onClick={() => onSection(id)}>
            {label}
            {id === "chat" && bs.chatUnread > 0 && <span className="badge us">{bs.chatUnread}</span>}
          </button>
        ))}
      </div>
      {section === "chat" && <Chat bs={bs} me={me} users={users} />}
      {section === "dinner" && <Dinner bs={bs} me={me} users={users} onPlan={onPlan} />}
      {section === "dates" && <Dates bs={bs} me={me} users={users} onPlan={onPlan} />}
      {section === "memories" && <Memories bs={bs} me={me} />}
      {section === "gifts" && <Gifts bs={bs} me={me} users={users} />}
    </div>
  );
}

function IdeaAdder({ bs, list, placeholder }: { bs: Backstage; list: "date" | "dinner"; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <form
      className="bs-quickline"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.trim()) return;
        if (await bs.addUs({ kind: "idea", list, title: v.trim() })) setV("");
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} maxLength={120} aria-label="New idea" />
    </form>
  );
}

function IdeaList({ bs, items }: { bs: Backstage; items: UsItem[] }) {
  return (
    <ul className="bs-chips">
      {items.map((i) => (
        <li key={i.id} style={{ ["--who" as string]: colorOf(i.added_by) }}>
          {i.title}
          <button className="bs-x" aria-label={`Remove ${i.title}`} onClick={() => bs.deleteUs(i.id)}>
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

// ——— the swipe games: dinner and dates ———
// Both of you swipe through the same deck (shuffled the same way each day);
// the first card you both say yes to wins. Swipe LEFT = yes (green tick),
// swipe RIGHT = no (red cross).
type Card = { key: string; title: string; emoji: string; ref?: string; mine?: boolean };
type GameWords = { thing: string; things: string; prize: string; plan: string; ownEmoji: string };

function SwipeGame({
  bs,
  me,
  users,
  game,
  built,
  words,
  onPlan,
}: {
  bs: Backstage;
  me: Me;
  users: Person[];
  game: Game;
  built: Card[];
  words: GameWords;
  onPlan: (title: string) => void;
}) {
  const other = users.find((u) => u.id !== me.id);
  const ideas = bs.us.filter((x) => x.kind === "idea" && x.list === game);
  const today = ymd(new Date());

  // the deck: your own ideas first, then the built-in cards
  const deck = useMemo<Card[]>(() => {
    const own = ideas.map((i) => ({ key: i.id, title: i.title, emoji: i.emoji ?? words.ownEmoji, ref: i.id, mine: true }));
    return [...shuffleForDay(own, today), ...shuffleForDay(built, today)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas.map((i) => i.id).join(","), today, built]);

  const keyOf = (v: UsItem) => v.ref ?? v.title;
  const inDeck = new Set(deck.map((c) => c.key));
  const votes = bs.us.filter((x) => x.kind === "vote" && inDeck.has(keyOf(x)));
  const [local, setLocal] = useState<Map<string, boolean>>(new Map());
  const myVotes = new Map(votes.filter((v) => v.added_by === me.id).map((v) => [keyOf(v), v.yes === true]));
  for (const [k, y] of local) myVotes.set(k, y);
  const theirYes = new Set(votes.filter((v) => v.added_by !== me.id && v.yes).map(keyOf));
  const theirCount = votes.filter((v) => v.added_by !== me.id).length;
  // The match is the first card you both said yes to (by when the second yes
  // landed), so both of you are shown the same one.
  const yesAt = (who: "me" | "them", key: string) => {
    const v = votes.find((x) => (who === "me" ? x.added_by === me.id : x.added_by !== me.id) && x.yes && keyOf(x) === key);
    return v ? new Date(v.created_at).getTime() : Date.now();
  };
  const match = deck
    .filter((c) => myVotes.get(c.key) === true && theirYes.has(c.key))
    .map((c) => ({ c, at: Math.max(yesAt("me", c.key), yesAt("them", c.key)) }))
    .sort((a, b) => a.at - b.at)[0]?.c;
  const next = deck.find((c) => !myVotes.has(c.key));
  const done = deck.filter((c) => myVotes.has(c.key)).length;

  const [drag, setDrag] = useState(0);
  const [fly, setFly] = useState<0 | -1 | 1>(0);
  const start = useRef<number | null>(null);

  const vote = (yes: boolean) => {
    if (!next || fly) return;
    const card = next;
    setFly(yes ? -1 : 1);
    window.setTimeout(() => {
      setLocal((m) => new Map(m).set(card.key, yes));
      setFly(0);
      setDrag(0);
    }, 220);
    void Promise.resolve(bs.addUs(card.ref ? { kind: "vote", ref: card.ref, yes } : { kind: "vote", title: card.key, yes })).then(() => {
      // a yes may have just made a match: look straight away, don't wait for the next check
      if (yes) window.dispatchEvent(new Event("backstage:check"));
    });
  };
  const restart = () => {
    setLocal(new Map());
    void bs.clearVotes(game);
  };

  // left = yes, right = no
  const leaning = fly ? (fly < 0 ? "yes" : "no") : drag < -30 ? "yes" : drag > 30 ? "no" : "";
  const strength = fly ? 1 : Math.min(1, Math.abs(drag) / 110);
  const x = fly ? fly * 480 : drag;

  if (match)
    return (
      <div className="bs-match">
        <Confetti />
        <span className="e">{match.emoji}</span>
        <h3>{game === "dinner" ? "It’s a match!" : "It’s a date!"}</h3>
        <p className="big">{match.title}</p>
        <p className="quiet small">You and {other?.name} both said yes.</p>
        <div className="bs-row-btns">
          <button className="btn" onClick={() => onPlan(match.title)}>
            {words.plan}
          </button>
          <button className="btn ghost" onClick={restart}>
            Play again
          </button>
        </div>
      </div>
    );
  if (!next)
    return (
      <div className="bs-empty center">
        <p>
          You&rsquo;ve been through all {deck.length} {words.things}.{" "}
          {theirCount ? `No match with ${other?.name} yet: they may still be swiping.` : `Waiting for ${other?.name} to swipe.`}
        </p>
        <button className="btn ghost" onClick={restart}>
          Start again
        </button>
      </div>
    );
  return (
    <>
      <p className="quiet small center">
        Swipe <strong className="ok">left for yes ✓</strong>, <strong className="nope">right for no ✕</strong>. The first{" "}
        {words.thing} you both say yes to is {words.prize}.
        {theirCount ? ` ${other?.name} has swiped ${theirCount}.` : ` ${other?.name} hasn't started yet.`}
      </p>
      <div className="bs-deck">
        <div className="bs-swipe under" aria-hidden="true" />
        <div
          className={`bs-swipe${leaning ? ` ${leaning}` : ""}${fly ? " fly" : ""}`}
          style={{ transform: `translateX(${x}px) rotate(${x / 16}deg)` }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => start.current !== null && setDrag(e.clientX - start.current)}
          onPointerUp={() => {
            start.current = null;
            if (drag < -90) vote(true);
            else if (drag > 90) vote(false);
            else setDrag(0);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDrag(0);
          }}
        >
          <span className="stamp yes" style={{ opacity: leaning === "yes" ? strength : 0 }} aria-hidden="true">
            ✓
          </span>
          <span className="stamp no" style={{ opacity: leaning === "no" ? strength : 0 }} aria-hidden="true">
            ✕
          </span>
          <span className="e">{next.emoji}</span>
          <strong>{next.title}</strong>
          <small>{next.mine ? "one of your ideas" : `${done + 1} of ${deck.length}`}</small>
        </div>
      </div>
      <div className="bs-swipe-btns">
        <button className="yes" aria-label={`Yes to ${next.title}`} onClick={() => vote(true)}>
          ✓
        </button>
        <button className="no" aria-label={`No to ${next.title}`} onClick={() => vote(false)}>
          ✕
        </button>
      </div>
    </>
  );
}

// ——— what's for dinner ———
const DINNER_DECK: Card[] = DISHES.map((d) => ({ key: `${GAME_PREFIX.dinner}${d.key}`, title: d.title, emoji: d.emoji }));
function Dinner({ bs, me, users, onPlan }: { bs: Backstage; me: Me; users: Person[]; onPlan: (t: string, d: string, time: string) => void }) {
  const ideas = bs.us.filter((x) => x.kind === "idea" && x.list === "dinner");
  return (
    <div className="bs-dinner">
      <SwipeGame
        bs={bs}
        me={me}
        users={users}
        game="dinner"
        built={DINNER_DECK}
        words={{ thing: "dish", things: "dishes", prize: "dinner", plan: "Put it in the calendar", ownEmoji: "🍽️" }}
        onPlan={(title) => onPlan(`Dinner: ${title}`, ymd(new Date()), "19:30")}
      />
      <h3 className="bs-sub">Your own dinner ideas</h3>
      <p className="bs-hint">These go to the front of the deck, ahead of the {DISHES.length} built-in dishes.</p>
      <IdeaAdder bs={bs} list="dinner" placeholder="Add a dinner idea…" />
      <IdeaList bs={bs} items={ideas} />
    </div>
  );
}

// ——— date night: the same game, with date ideas ———
const DATE_DECK: Card[] = DATES.map((d) => ({ key: `${GAME_PREFIX.date}${d.key}`, title: d.title, emoji: d.emoji }));
export const nextSaturday = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return ymd(d);
};
function Dates({ bs, me, users, onPlan }: { bs: Backstage; me: Me; users: Person[]; onPlan: (t: string, d: string, time: string) => void }) {
  const own = bs.us.filter((x) => x.kind === "idea" && x.list === "date");
  const [browse, setBrowse] = useState(false);
  const sat = nextSaturday();
  return (
    <div className="bs-dates">
      <SwipeGame
        bs={bs}
        me={me}
        users={users}
        game="date"
        built={DATE_DECK}
        words={{ thing: "idea", things: "date ideas", prize: "your next date", plan: "Book it for Saturday", ownEmoji: "💘" }}
        onPlan={(title) => onPlan(`Date night: ${title}`, sat, "19:00")}
      />
      <h3 className="bs-sub">Your own date ideas</h3>
      <p className="bs-hint">These go to the front of the deck, ahead of the {DATES.length} built-in ideas.</p>
      <IdeaAdder bs={bs} list="date" placeholder="Add a date idea (that new place in Soho…)" />
      <IdeaList bs={bs} items={own} />
      <button className="bs-fold" aria-expanded={browse} onClick={() => setBrowse((v) => !v)}>
        {browse ? "Hide" : "See"} all {DATES.length} built-in ideas <span aria-hidden="true">{browse ? "▴" : "▾"}</span>
      </button>
      {browse && (
        <ul className="bs-chips">
          {DATES.map((d) => (
            <li key={d.key}>
              <button className="bs-link" onClick={() => onPlan(`Date night: ${d.title}`, sat, "19:00")} title="Book it for Saturday">
                {d.emoji} {d.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ——— memory jar ———
function Memories({ bs, me }: { bs: Backstage; me: Me }) {
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("❤️");
  const [day, setDay] = useState(ymd(new Date()));
  const list = useMemo(
    () => bs.us.filter((x) => x.kind === "memory").sort((a, b) => (b.day ?? "").localeCompare(a.day ?? "")),
    [bs.us]
  );
  return (
    <div className="bs-memories">
      <form
        className="bs-mem-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await bs.addUs({ kind: "memory", title: text, emoji, day })) setText("");
        }}
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="A moment worth keeping: “Sunset on the Bosphorus, you stole my chips”" rows={2} maxLength={1000} required aria-label="The moment" />
        <div className="row">
          <select value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji">
            {["❤️", "😂", "🌅", "✈️", "🍽️", "🎉", "🥹", "🏡", "📸", "💍"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input type="date" value={day} max={ymd(new Date())} onChange={(e) => setDay(e.target.value)} aria-label="When" />
          <button className="btn" type="submit">
            Keep it
          </button>
        </div>
      </form>
      {list.length ? (
        <ol className="bs-mem-list">
          {list.map((m) => (
            <li key={m.id} style={{ ["--who" as string]: colorOf(m.added_by), ["--soft" as string]: softOf(m.added_by) }}>
              <span className="e">{m.emoji ?? "💭"}</span>
              <div>
                <p>{m.title}</p>
                <small>
                  {m.day ? new Date(m.day + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""} ·{" "}
                  {m.added_by === me.id ? "you" : nameOf(m.added_by)}
                </small>
              </div>
              <button className="bs-x" aria-label="Remove" onClick={() => bs.deleteUs(m.id)}>
                ×
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="bs-empty">The jar is empty. Add your first moment above; one pops up on the Today screen now and then.</p>
      )}
    </div>
  );
}

// ——— gift ideas (private) ———
function Gifts({ bs, me, users }: { bs: Backstage; me: Me; users: Person[] }) {
  const other = users.find((u) => u.id !== me.id);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const gifts = bs.us.filter((x) => x.kind === "gift");
  const theirBday = other ? bs.birthdays[other.id] : null;
  const myBday = bs.birthdays[me.id];
  return (
    <div className="bs-gifts">
      <p className="bs-private">🔒 Only you can see this list. {other?.name} never sees it.</p>
      {theirBday ? (
        <p className="quiet">
          🎂 {other?.name}&rsquo;s birthday: {new Date(theirBday + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })} (in {nextYearly(theirBday).days} days). You&rsquo;ll get a reminder two weeks before.
        </p>
      ) : (
        <p className="quiet">When {other?.name} adds their birthday, you&rsquo;ll get a reminder two weeks before.</p>
      )}
      <form
        className="bs-mini-form wide"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await bs.addUs({ kind: "gift", title, body: notes || null })) {
            setTitle("");
            setNotes("");
          }
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Gift idea for ${other?.name ?? "them"}`} required maxLength={200} aria-label="Gift idea" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Link, size, shop… (optional)" maxLength={1000} aria-label="Notes" />
        <button className="btn small" type="submit">
          Add
        </button>
      </form>
      <ul className="bs-giftlist">
        {gifts.map((g) => (
          <li key={g.id} className={g.done ? "done" : undefined}>
            <input type="checkbox" checked={g.done} onChange={() => bs.patchUs(g.id, { done: !g.done })} aria-label={g.done ? "Not bought" : "Bought"} />
            <div>
              <strong>{g.title}</strong>
              {g.body && (/^https?:\/\//.test(g.body) ? <a href={g.body} target="_blank" rel="noreferrer">{g.body}</a> : <small>{g.body}</small>)}
            </div>
            <button className="bs-x" aria-label="Remove" onClick={() => bs.deleteUs(g.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <h3 className="bs-sub">Your birthday</h3>
      <p className="quiet small">So {other?.name} gets a heads-up (they won&rsquo;t see your gift list either).</p>
      <input type="date" className="bs-bday-input" defaultValue={myBday ?? ""} onBlur={(e) => e.target.value !== (myBday ?? "") && void bs.setBirthday(e.target.value || null)} aria-label="Your birthday" />
    </div>
  );
}
