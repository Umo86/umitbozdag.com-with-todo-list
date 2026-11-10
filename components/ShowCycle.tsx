"use client";

// The show cycle as a build schedule: each workstream is a bar that draws in
// from its start date when the chart scrolls into view.
import { motion, useReducedMotion } from "motion/react";
import { CYCLE, CYCLE_TICKS } from "@/lib/content";

export default function ShowCycle() {
  const reduce = useReducedMotion();
  return (
    <div className="cycle" role="img" aria-label={`A typical show cycle, twelve months out to breakdown: ${CYCLE.map((r) => r.label).join(", ")}.`}>
      <div className="cycle-axis" aria-hidden="true">
        <span className="cycle-label" />
        <div className="cycle-track">
          {CYCLE_TICKS.map((t, i) => (
            <span
              key={t.label}
              className={`cycle-tick${i % 2 ? " minor" : ""}`}
              style={{ left: `${t.at * 100}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
      {CYCLE.map((row, i) => (
        <div className="cycle-row" key={row.label} aria-hidden="true">
          <span className="cycle-label">{row.label}</span>
          <div className="cycle-track">
            {CYCLE_TICKS.map((t) => (
              <i key={t.label} className="cycle-grid" style={{ left: `${t.at * 100}%` }} />
            ))}
            <motion.span
              className={`cycle-bar${row.onSite ? ` on-site ${row.onSite}` : ""}`}
              style={{
                left: `${row.start * 100}%`,
                width: `${(row.end - row.start) * 100}%`,
              }}
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5 + (row.end - row.start) * 0.9,
                delay: 0.15 + i * 0.11,
                ease: [0.3, 0.6, 0.2, 1],
              }}
            />
          </div>
        </div>
      ))}
      <p className="cycle-note">
        A typical large trade show. The on-site fortnight is drawn wider than
        scale so build-up, open days and breakdown can be read.
      </p>
    </div>
  );
}
