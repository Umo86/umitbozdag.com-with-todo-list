"use client";

// Where the shows were: a dot-matrix world map with flight paths drawn from
// London to each city when the map scrolls into view. Each city carries its
// flag; pointing at (or tapping) a city lifts its route and lists the events
// delivered there, with their logos.
import { useEffect, useMemo, useRef, useState } from "react";
import { PROFILE as p } from "@/lib/content";
import dots from "@/lib/worldmap-dots.json";

const W = 1000;
const LAT_TOP = 78;
const LAT_BOTTOM = -56;
const H = Math.round((W * (LAT_TOP - LAT_BOTTOM)) / 360);
const project = (lat: number, lon: number) => ({
  x: +(((lon + 180) / 360) * W).toFixed(1),
  y: +(((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H).toFixed(1),
});
// every land dot as one path of zero-length round-capped strokes
const DOTS = (dots as number[][]).map(([x, y]) => `M${x} ${y}h0`).join("");

const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const initials = (name: string) =>
  name.replace(/[^A-Za-z0-9 &]/g, "").split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("").toUpperCase();

const CITIES = p.cities.map((c) => {
  const shows = p.shows.filter((s) =>
    c.hq ? s.country === c.country : s.city.split(",")[0] === c.name
  );
  return { ...c, id: slug(c.name), ...project(c.lat, c.lon), shows };
});
const HQ = CITIES.find((c) => c.hq)!;

function Flag({ code }: { code: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="flag" src={`/img/flags/${code}.svg`} alt="" width={20} height={15} />;
}

export default function WorldMap() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hot, setHot] = useState<string | null>(null); // pointed at
  const [picked, setPicked] = useState<string>(HQ.id); // shown in the panel

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return setVisible(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const routes = useMemo(
    () =>
      CITIES.filter((c) => !c.hq).map((c, i) => {
        const mx = (HQ.x + c.x) / 2;
        const my = Math.min(HQ.y, c.y) - Math.hypot(c.x - HQ.x, c.y - HQ.y) * 0.35;
        return { id: c.id, i, d: `M${HQ.x},${HQ.y} Q${mx.toFixed(1)},${my.toFixed(1)} ${c.x},${c.y}` };
      }),
    []
  );

  const active = hot ?? picked;
  const city = CITIES.find((c) => c.id === active) ?? HQ;
  const lit = (id: string) => (active !== HQ.id && id === active ? " is-hot" : "");
  const on = (id: string) => ({
    onMouseEnter: () => setHot(id),
    onMouseLeave: () => setHot(null),
    onFocus: () => setHot(id),
    onBlur: () => setHot(null),
    onClick: () => setPicked(id),
  });

  return (
    <div className="world__map">
      <div
        className={`map${visible ? " is-visible" : ""}${active !== HQ.id ? " has-hot" : ""}`}
        ref={ref}
      >
        <svg className="map__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="World map of event locations">
          <path className="map__dots" d={DOTS} />
          <g className="map__routes">
            {routes.map((r) => (
              <path
                key={r.id}
                d={r.d}
                className={lit(r.id).trim() || undefined}
                style={{ "--i": r.i } as React.CSSProperties}
              />
            ))}
          </g>
          <g className="map__cities">
            {CITIES.map((c, i) => (
              <g
                key={c.id}
                className={`city${c.hq ? " city--hq" : ""}${lit(c.id)}`}
                style={{ "--i": i } as React.CSSProperties}
                transform={`translate(${c.x},${c.y})`}
              >
                <circle className="city__pulse" r="5" />
                <circle className="city__dot" r="4.5" />
              </g>
            ))}
          </g>
        </svg>
        <div className="map__labels">
          {CITIES.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`map__label${c.hq ? " map__label--hq" : ""}${c.label
                .split(" ")
                .filter(Boolean)
                .map((m) => ` map__label--${m}`)
                .join("")}${lit(c.id)}`}
              style={
                {
                  left: `${((c.x / W) * 100).toFixed(2)}%`,
                  top: `${((c.y / H) * 100).toFixed(2)}%`,
                  "--i": i,
                } as React.CSSProperties
              }
              tabIndex={-1}
              aria-hidden="true"
              {...on(c.id)}
            >
              <Flag code={c.flag} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <ul className="world__cities" aria-label="Cities">
        {[...CITIES]
          .sort((a, b) => a.x - b.x)
          .map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`world__city${c.id === picked ? " is-picked" : ""}${c.id === active ? " is-hot" : ""}`}
                aria-pressed={c.id === picked}
                {...on(c.id)}
              >
                <Flag code={c.flag} />
                {c.name}
                {c.hq && <small>Base</small>}
              </button>
            </li>
          ))}
      </ul>

      <div className="world__panel" aria-live="polite">
        <div className="world__where">
          <Flag code={city.flag} />
          <strong>
            {city.hq ? "London and the UK" : `${city.name}, ${city.country}`}
          </strong>
          <span>
            {city.shows.length} {city.shows.length === 1 ? "event" : "events"}
          </span>
        </div>
        <ul className="world__events">
          {city.shows.map((s) => (
            <li key={s.id}>
              <a href={`/shows/${s.id}`} title={s.name}>
                <span className="evt__logo">
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt="" loading="lazy" />
                  ) : (
                    <span className="initials">{initials(s.name)}</span>
                  )}
                </span>
                <span className="world__evname">{s.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
