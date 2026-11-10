"use client";

// The "Us" tab: chat, plus the things just for the two of you: what's for
// dinner (swipe until you match), date-night roulette, the memory jar and a
// private gift-ideas list.
import { useEffect, useMemo, useRef, useState } from "react";
import { ymd } from "@/lib/parse";
import Chat from "./Chat";
import { Confetti, nextYearly } from "./Fun";
import { colorOf, nameOf, softOf, type Me, type Person, type UsItem } from "./types";
import type { Backstage } from "./useBackstage";

export type UsSection = "chat" | "dinner" | "dates" | "memories" | "gifts";
const SECTIONS: Array<[UsSection, string]> = [
  ["chat", "💬 Chat"],
  ["dinner", "🍽️ Dinner"],
  ["dates", "🎲 Dates"],
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
      {section === "dates" && <Dates bs={bs} onPlan={onPlan} />}
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

// ——— what's for dinner: both swipe, first match wins ———
function Dinner({ bs, me, users, onPlan }: { bs: Backstage; me: Me; users: Person[]; onPlan: (t: string, d: string, time: string) => void }) {
  const other = users.find((u) => u.id !== me.id);
  const ideas = bs.us.filter((x) => x.kind === "idea" && x.list === "dinner");
  const votes = bs.us.filter((x) => x.kind === "vote");
  const myVotes = new Map(votes.filter((v) => v.added_by === me.id).map((v) => [v.ref, v.yes]));
  const theirYes = new Set(votes.filter((v) => v.added_by !== me.id && v.yes).map((v) => v.ref));
  const match = ideas.find((i) => myVotes.get(i.id) === true && theirYes.has(i.id));
  const next = ideas.find((i) => !myVotes.has(i.id));
  const theyVoted = votes.some((v) => v.added_by !== me.id);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  const vote = (yes: boolean) => {
    if (!next) return;
    setDrag(0);
    void bs.addUs({ kind: "vote", ref: next.id, yes });
  };

  return (
    <div className="bs-dinner">
      {match ? (
        <div className="bs-match">
          <Confetti />
          <span className="e">{match.emoji ?? "🍽️"}</span>
          <h3>It&rsquo;s a match!</h3>
          <p className="big">{match.title}</p>
          <div className="bs-row-btns">
            <button className="btn" onClick={() => onPlan(`Dinner: ${match.title}`, ymd(new Date()), "19:30")}>
              Put it in the calendar
            </button>
            <button className="btn ghost" onClick={() => bs.clearUs("my-votes")}>
              Swipe again
            </button>
          </div>
        </div>
      ) : next ? (
        <>
          <p className="quiet small center">
            Swipe right (or ♥) if you fancy it. When you both say yes to the same thing, it&rsquo;s dinner.
            {theyVoted ? ` ${other?.name} has started swiping.` : ""}
          </p>
          <div
            className="bs-swipe"
            style={{ transform: `translateX(${drag}px) rotate(${drag / 18}deg)`, borderColor: drag > 40 ? "#06d6a0" : drag < -40 ? "#e5383b" : undefined }}
            onPointerDown={(e) => {
              start.current = e.clientX;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => start.current !== null && setDrag(e.clientX - start.current)}
            onPointerUp={() => {
              start.current = null;
              if (drag > 90) vote(true);
              else if (drag < -90) vote(false);
              else setDrag(0);
            }}
          >
            <span className="e">{next.emoji ?? "🍽️"}</span>
            <strong>{next.title}</strong>
            <small>added by {nameOf(next.added_by)}</small>
          </div>
          <div className="bs-swipe-btns">
            <button className="no" aria-label="No" onClick={() => vote(false)}>
              ✕
            </button>
            <button className="yes" aria-label="Yes" onClick={() => vote(true)}>
              ♥
            </button>
          </div>
        </>
      ) : ideas.length ? (
        <div className="bs-empty center">
          <p>
            You&rsquo;ve swiped everything. {theyVoted ? `No match with ${other?.name} yet.` : `Waiting for ${other?.name} to swipe.`}
          </p>
          <button className="btn ghost" onClick={() => bs.clearUs("my-votes")}>
            Start again
          </button>
        </div>
      ) : (
        <p className="bs-empty">Add a few dinner ideas below (lahmacun, sushi, Mangal, pasta at home…), then both swipe.</p>
      )}
      <h3 className="bs-sub">Dinner ideas</h3>
      <IdeaAdder bs={bs} list="dinner" placeholder="Add a dinner idea…" />
      <IdeaList bs={bs} items={ideas} />
    </div>
  );
}

// ——— date night roulette ———
function Dates({ bs, onPlan }: { bs: Backstage; onPlan: (t: string, d: string, time: string) => void }) {
  const ideas = bs.us.filter((x) => x.kind === "idea" && x.list === "date");
  const [spin, setSpin] = useState<string | null>(null);
  const [result, setResult] = useState<UsItem | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  const go = () => {
    if (!ideas.length) return;
    setResult(null);
    let n = 0;
    const final = ideas[Math.floor(Math.random() * ideas.length)];
    timer.current = setInterval(() => {
      n++;
      setSpin(ideas[n % ideas.length].title);
      if (n > 14 + ideas.length) {
        clearInterval(timer.current!);
        setSpin(null);
        setResult(final);
      }
    }, 90);
  };
  const sat = (() => {
    const d = new Date();
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    return ymd(d);
  })();
  return (
    <div className="bs-dates">
      <div className="bs-roulette">
        {result && <Confetti />}
        <span className="e">{result ? result.emoji ?? "💘" : "🎲"}</span>
        <p className="big">{spin ?? result?.title ?? (ideas.length ? "What shall we do?" : "Add some date ideas first")}</p>
        <div className="bs-row-btns center">
          <button className="btn" onClick={go} disabled={!ideas.length || !!spin}>
            {result ? "Spin again" : "Spin"}
          </button>
          {result && (
            <button className="btn ghost" onClick={() => onPlan(`Date night: ${result.title}`, sat, "19:00")}>
              Book it for Saturday
            </button>
          )}
        </div>
      </div>
      <h3 className="bs-sub">Date ideas</h3>
      <IdeaAdder bs={bs} list="date" placeholder="Add a date idea (picnic in Greenwich, cooking class…)" />
      <IdeaList bs={bs} items={ideas} />
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
