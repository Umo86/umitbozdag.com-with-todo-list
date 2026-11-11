"use client";

// The fun bits on the Today screen: how you both feel today, countdowns,
// the chore battle, a birthday heads-up and a memory from the jar.
import { useEffect, useMemo, useState } from "react";
import { ymd } from "@/lib/parse";
import { colorOf, nameOf, softOf, type Me, type Person, type Score, type UsItem, type UserId } from "./types";
import type { Backstage } from "./useBackstage";

export const MOODS: Array<[string, string]> = [
  ["🔥", "On fire"],
  ["😊", "Happy"],
  ["😌", "Chilled"],
  ["😴", "Tired"],
  ["🤯", "Busy"],
  ["😤", "Stressed"],
  ["🤒", "Not well"],
  ["🤗", "Need a hug"],
];
const moodLabel = (e: string | null) => MOODS.find(([m]) => m === e)?.[1] ?? "";

const DAY = 86_400_000;
const parse = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd);
};
export const daysUntil = (d: string) => Math.round((parse(d).getTime() - parse(ymd(new Date())).getTime()) / DAY);

/** The next time a yearly date (a birthday) comes round, and how far off it is. */
export function nextYearly(d: string): { date: Date; days: number; age: number } {
  const b = parse(d);
  const now = parse(ymd(new Date()));
  let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  if (next < now) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
  return { date: next, days: Math.round((next.getTime() - now.getTime()) / DAY), age: next.getFullYear() - b.getFullYear() };
}

// ——— mood ———
export function MoodBar({ bs, me, users }: { bs: Backstage; me: Me; users: Person[] }) {
  const today = ymd(new Date());
  const other = users.find((u) => u.id !== me.id);
  const mine = bs.us.find((x) => x.kind === "mood" && x.added_by === me.id && x.day === today);
  const theirs = other ? bs.us.find((x) => x.kind === "mood" && x.added_by === other.id && x.day === today) : undefined;
  const [open, setOpen] = useState(false);
  return (
    <section className="bs-mood" aria-label="Moods today">
      <div className="me">
        <span className="q">How are you today?</span>
        {mine && !open ? (
          <button className="current" onClick={() => setOpen(true)} style={{ background: softOf(me.id) }}>
            <span className="e">{mine.emoji}</span> {moodLabel(mine.emoji)} <span className="quiet small">change</span>
          </button>
        ) : (
          <div className="pick" role="group" aria-label="Pick your mood">
            {MOODS.map(([e, l]) => (
              <button
                key={e}
                title={l}
                aria-label={l}
                aria-pressed={mine?.emoji === e}
                onClick={() => {
                  void bs.addUs({ kind: "mood", emoji: e });
                  setOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      {other && (
        <div className="them" style={{ ["--who" as string]: other.color }}>
          <span className="bs-avatar" style={{ background: other.color }}>
            {other.name[0]}
          </span>
          {theirs ? (
            <span>
              {other.name} is feeling <strong>{theirs.emoji} {moodLabel(theirs.emoji).toLowerCase()}</strong>
              {theirs.emoji === "🤗" ? " — go give a hug" : ""}
            </span>
          ) : (
            <span className="quiet">{other.name} hasn&rsquo;t checked in yet today.</span>
          )}
        </div>
      )}
    </section>
  );
}

// ——— countdowns ———
export function Countdowns({ bs }: { bs: Backstage }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [emoji, setEmoji] = useState("✈️");
  const list = bs.us
    .filter((x) => x.kind === "countdown" && x.day && daysUntil(x.day) >= -1)
    .sort((a, b) => a.day!.localeCompare(b.day!));
  const today = list.some((x) => daysUntil(x.day!) === 0);
  return (
    <section className="bs-countdowns" aria-label="Countdowns">
      {today && <Confetti />}
      <div className="bs-side-head">
        <h2>Countdowns</h2>
        <button className="bs-link" onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "+ Add"}
        </button>
      </div>
      {adding && (
        <form
          className="bs-mini-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await bs.addUs({ kind: "countdown", title, day, emoji });
            if (ok) {
              setTitle("");
              setDay("");
              setAdding(false);
            }
          }}
        >
          <select value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji">
            {["✈️", "💍", "🎂", "🏖️", "🎉", "🏠", "👶", "🎄", "🌙", "❤️", "🏟️", "🎟️"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Istanbul trip" required maxLength={120} aria-label="What" />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required aria-label="When" min={ymd(new Date())} />
          <button className="btn small" type="submit">
            Add
          </button>
        </form>
      )}
      {list.length ? (
        <ul>
          {list.map((c) => {
            const n = daysUntil(c.day!);
            return (
              <li key={c.id} className={n === 0 ? "today" : undefined} style={{ ["--who" as string]: colorOf(c.added_by) }}>
                <span className="e" aria-hidden="true">
                  {c.emoji ?? "⏳"}
                </span>
                <span className="n">{n <= 0 ? (n === 0 ? "Today!" : "Yesterday") : n}</span>
                <span className="t">
                  {n > 0 && <small>{n === 1 ? "day to" : "days to"}</small>}
                  {c.title}
                </span>
                <button className="bs-x" aria-label={`Remove ${c.title}`} onClick={() => bs.deleteUs(c.id)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !adding && <p className="quiet small">Holidays, anniversaries, the next big show: add a countdown.</p>
      )}
    </section>
  );
}

// ——— the chore battle ———
export function Scoreboard({ scores, users, me }: { scores: Score[]; users: Person[]; me: Me }) {
  const pts = (id: string, k: "this_week" | "last_week") => scores.find((s) => s.who === id)?.[k] ?? 0;
  const [a, b] = users;
  if (!a || !b) return null;
  const champ = lastWeekChampion(scores, users);
  const lead = pts(a.id, "this_week") === pts(b.id, "this_week") ? null : pts(a.id, "this_week") > pts(b.id, "this_week") ? a : b;
  const total = Math.max(1, pts(a.id, "this_week") + pts(b.id, "this_week"));
  return (
    <section className="bs-score" aria-label="Chore battle">
      <div className="bs-side-head">
        <h2>Chore battle · this week</h2>
        <span className="quiet small">joint to-dos ticked off · urgent = 2 pts</span>
      </div>
      <div className="duel">
        {[a, b].map((u) => (
          <div key={u.id} className="side" style={{ color: u.color }}>
            <span className="name">
              {champ === u.id && <span title="Last week's champion">👑 </span>}
              {u.id === me.id ? "You" : u.name}
            </span>
            <strong>{pts(u.id, "this_week")}</strong>
          </div>
        ))}
      </div>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${(pts(a.id, "this_week") / total) * 100}%`, background: a.color }} />
        <span style={{ width: `${(pts(b.id, "this_week") / total) * 100}%`, background: b.color }} />
      </div>
      <p className="quiet small">
        {lead
          ? `${lead.id === me.id ? "You're" : `${lead.name} is`} winning. Loser picks the takeaway on Sunday 🥡`
          : pts(a.id, "this_week")
            ? "Neck and neck! 🤝"
            : "No points yet this week. First tick wins the lead."}
      </p>
    </section>
  );
}
export function lastWeekChampion(scores: Score[], users: Person[]): UserId | null {
  const [a, b] = users;
  if (!a || !b) return null;
  const pa = scores.find((s) => s.who === a.id)?.last_week ?? 0;
  const pb = scores.find((s) => s.who === b.id)?.last_week ?? 0;
  if (pa === pb) return null;
  return pa > pb ? a.id : b.id;
}

// ——— birthdays ———
export function BirthdayNote({ bs, me, users, onGifts }: { bs: Backstage; me: Me; users: Person[]; onGifts: () => void }) {
  const other = users.find((u) => u.id !== me.id);
  const theirs = other ? bs.birthdays[other.id] : null;
  const mine = bs.birthdays[me.id];
  const items: React.ReactNode[] = [];
  if (other && theirs) {
    const n = nextYearly(theirs);
    if (n.days <= 21) {
      const gifts = bs.us.filter((x) => x.kind === "gift" && !x.done).length;
      items.push(
        <button key="t" className="bs-bday" onClick={onGifts}>
          <span className="e">🎂</span>
          <span>
            <strong>
              {n.days === 0 ? `It's ${other.name}'s birthday today!` : `${other.name}'s birthday in ${n.days} day${n.days === 1 ? "" : "s"}`}
            </strong>
            <small>{gifts ? `${gifts} gift idea${gifts === 1 ? "" : "s"} saved · open the list` : "No gift ideas yet · add some (they can't see them)"}</small>
          </span>
        </button>
      );
    }
  }
  if (mine && nextYearly(mine).days === 0) {
    items.push(
      <div key="m" className="bs-bday mine">
        <Confetti />
        <span className="e">🥳</span>
        <strong>Happy birthday, {me.name}!</strong>
      </div>
    );
  }
  return items.length ? <>{items}</> : null;
}

// ——— memory jar: one memory a day ———
export function MemoryOfTheDay({ bs, onOpen }: { bs: Backstage; onOpen: () => void }) {
  const memories = bs.us.filter((x) => x.kind === "memory");
  const pick = useMemo(() => {
    if (!memories.length) return null;
    const seed = Number(ymd(new Date()).replace(/-/g, ""));
    return memories[seed % memories.length];
  }, [memories]);
  if (!pick) return null;
  return (
    <button className="bs-memory" onClick={onOpen} style={{ ["--who" as string]: colorOf(pick.added_by) }}>
      <span className="k">Remember this? {pick.emoji ?? "💭"}</span>
      <span className="t">&ldquo;{pick.title}&rdquo;</span>
      <span className="d">
        {pick.day ? new Date(pick.day + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""} · {nameOf(pick.added_by)}
      </span>
    </button>
  );
}

// ——— confetti ———
export function Confetti() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  const colors = ["#1a47ff", "#e0457b", "#ffb703", "#06d6a0", "#8338ec"];
  return (
    <div className="bs-confetti" aria-hidden="true">
      {Array.from({ length: 60 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 53) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 12) * 0.08}s`,
            animationDuration: `${2.2 + (i % 5) * 0.3}s`,
            transform: `rotate(${i * 37}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export type { UsItem };

// ——— dinner game: the dish you both said yes to, shown to both of you ———
export function DinnerMatchAlert({
  title,
  emoji,
  otherName,
  onPlan,
  onClose,
}: {
  title: string;
  emoji: string;
  otherName: string;
  onPlan: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="bs-scrim bs-matchpop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bs-match pop" role="alertdialog" aria-modal="true" aria-label={`Dinner match: ${title}`}>
        <Confetti />
        <span className="e">{emoji}</span>
        <h3>It&rsquo;s a match!</h3>
        <p className="big">{title}</p>
        <p className="quiet small">You and {otherName} both said yes. That&rsquo;s dinner sorted.</p>
        <div className="bs-row-btns">
          <button className="btn" onClick={onPlan}>
            Put it in the calendar
          </button>
          <button className="btn ghost" onClick={onClose} autoFocus>
            Lovely
          </button>
        </div>
      </div>
    </div>
  );
}
