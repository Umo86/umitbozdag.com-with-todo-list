"use client";

// Every show, newest first, with a filter by organiser.
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

export default function EventsList({
  shows,
  employers,
}: {
  shows: Show[];
  employers: Employer[];
}) {
  const [org, setOrg] = useState<string>("all");
  const count = (id: string) => shows.filter((s) => s.organiser === id).length;
  const nameOf = (id: string) => employers.find((e) => e.id === id)?.name;
  const list = org === "all" ? shows : shows.filter((s) => s.organiser === org);
  return (
    <>
      <div className="filters" role="group" aria-label="Filter events by organiser">
        <button type="button" aria-pressed={org === "all"} onClick={() => setOrg("all")}>
          All <span>{shows.length}</span>
        </button>
        {employers.map((e) => (
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
            <span>
              <strong>{s.name}</strong>
              <span className="evt__where">
                {s.press.length > 0 && <em className="evt__tag">In the press</em>}
                {[s.venue !== s.city ? s.venue : "", s.city, org === "all" ? nameOf(s.organiser) : ""]
                  .filter(Boolean)
                  .join(", ")}
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
