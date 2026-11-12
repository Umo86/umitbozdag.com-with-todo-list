"use client";

// Every show, newest first. Each row says which side of the show I was on
// (the organiser's team, or an exhibitor / sponsor), my role, who I worked
// for and where it was. Filter by side and by employer.
import { useState } from "react";
import type { Employer, Show } from "@/lib/content";

const initials = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 &]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export const SIDE: Record<string, string> = { organiser: "Organiser", exhibitor: "Exhibitor", sponsor: "Sponsor" };
type SideFilter = "all" | "organiser" | "exhibitor";
const onSide = (s: Show, f: SideFilter) => f === "all" || (f === "organiser" ? s.side === "organiser" : s.side !== "organiser");

export default function EventsList({ shows, employers }: { shows: Show[]; employers: Employer[] }) {
  const [side, setSide] = useState<SideFilter>("all");
  const [org, setOrg] = useState<string>("all");
  const bySide = shows.filter((s) => onSide(s, side));
  const count = (id: string) => bySide.filter((s) => s.organiser === id).length;
  const nameOf = (id: string) => employers.find((e) => e.id === id)?.name;
  const list = org === "all" ? bySide : bySide.filter((s) => s.organiser === org);
  const pick = (f: SideFilter) => {
    setSide(f);
    // keep the employer filter only if it still has shows on that side
    if (org !== "all" && !shows.some((s) => s.organiser === org && onSide(s, f))) setOrg("all");
  };
  return (
    <>
      <div className="sides" role="group" aria-label="Filter events by my side of the show">
        {(
          [
            ["all", "All events"],
            ["organiser", "As organiser"],
            ["exhibitor", "As exhibitor"],
          ] as Array<[SideFilter, string]>
        ).map(([f, label]) => (
          <button key={f} type="button" aria-pressed={side === f} onClick={() => pick(f)}>
            {label} <span>{shows.filter((s) => onSide(s, f)).length}</span>
          </button>
        ))}
      </div>
      <p className="sides__note">
        <strong>Organiser</strong>: I was on the team running the show. <strong>Exhibitor</strong>: I delivered a stand or
        presence at someone else&rsquo;s show.
      </p>
      <div className="filters" role="group" aria-label="Filter events by who I worked for">
        <button type="button" aria-pressed={org === "all"} onClick={() => setOrg("all")}>
          Everyone <span>{bySide.length}</span>
        </button>
        {employers
          .filter((e) => count(e.id) > 0)
          .map((e) => (
            <button key={e.id} type="button" aria-pressed={org === e.id} onClick={() => setOrg(e.id)}>
              {e.name} <span>{count(e.id)}</span>
            </button>
          ))}
      </div>
      <ul className="evt-grid">
        {list.map((s) => (
          <li key={s.id}>
            <a className="evt" href={`/shows/${s.id}`}>
              <span className="evt__logo">
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo} alt="" loading="lazy" />
                ) : (
                  <span className="initials">{initials(s.name)}</span>
                )}
              </span>
              <span className="evt__main">
                <span className="evt__title">
                  <strong>{s.name}</strong>
                  <em className={`evt__side evt__side--${s.side}`}>{SIDE[s.side] ?? s.side}</em>
                  {s.status === "planning" && <em className="evt__wip">Under construction</em>}
                  {s.press.length > 0 && <em className="evt__tag">In the press</em>}
                </span>
                <span className="evt__role">
                  {s.role}
                  {nameOf(s.organiser) ? ` · ${nameOf(s.organiser)}` : ""}
                </span>
                <span className="evt__where">
                  {[s.venue !== s.city ? s.venue : "", s.city, s.country].filter(Boolean).join(", ")}
                </span>
              </span>
              <span className="evt__year">{s.years}</span>
              <span className="evt__arr" aria-hidden="true">
                →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
