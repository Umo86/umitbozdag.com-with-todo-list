"use client";

// The hero figure: one exhibition hall taken through a show cycle, drawn as
// a blueprint (white line on navy).
// Floorplan is drawn → stands sell → the build goes in → doors open and
// visitors walk the aisles → breakdown hands the hall back empty.
// Plays once to "Show open" and rests there; the phase buttons let a
// visitor step through it themselves.
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const PLAN = "rgba(255,255,255,0.3)";
const INK = "#ffffff";
const NAVY = "#06143a";
const SOLD = "#2f5bff";

type Stand = { id: string; x: number; y: number; w: number; h: number; sold?: boolean };

const STANDS: Stand[] = [
  { id: "A10", x: 50, y: 50, w: 110, h: 62, sold: true },
  { id: "A12", x: 170, y: 50, w: 110, h: 62 },
  { id: "A14", x: 50, y: 122, w: 72, h: 63, sold: true },
  { id: "A16", x: 132, y: 122, w: 148, h: 63, sold: true },
  { id: "B20", x: 340, y: 50, w: 240, h: 58, sold: true },
  { id: "B22", x: 340, y: 118, w: 114, h: 67, sold: true },
  { id: "B24", x: 464, y: 118, w: 116, h: 67 },
  { id: "D10", x: 930, y: 50, w: 100, h: 135, sold: true },
  { id: "D12", x: 1040, y: 50, w: 110, h: 62, sold: true },
  { id: "D14", x: 1040, y: 122, w: 110, h: 63 },
  { id: "A40", x: 170, y: 245, w: 110, h: 58, sold: true },
  { id: "A42", x: 170, y: 313, w: 110, h: 57, sold: true },
  { id: "B40", x: 340, y: 245, w: 114, h: 125, sold: true },
  { id: "B42", x: 464, y: 245, w: 116, h: 58, sold: true },
  { id: "B44", x: 464, y: 313, w: 116, h: 57 },
  { id: "C40", x: 640, y: 245, w: 230, h: 52, sold: true },
  { id: "C42", x: 640, y: 307, w: 110, h: 63, sold: true },
  { id: "C44", x: 760, y: 307, w: 110, h: 63, sold: true },
  { id: "D40", x: 930, y: 245, w: 220, h: 58, sold: true },
  { id: "D42", x: 930, y: 313, w: 105, h: 57 },
  { id: "D44", x: 1045, y: 313, w: 105, h: 57, sold: true },
];

const AISLES = [
  { x1: 310, y1: 36, x2: 310, y2: 394 },
  { x1: 610, y1: 196, x2: 610, y2: 408 },
  { x1: 900, y1: 36, x2: 900, y2: 394 },
  { x1: 36, y1: 215, x2: 1164, y2: 215 },
];

// Visitor routes: in through the entrance, up the main aisle, then out
// along the cross aisle and the side aisles.
const ROUTES: Array<Array<[number, number]>> = [
  [[610, 430], [610, 215], [310, 215], [310, 60]],
  [[610, 430], [610, 215], [900, 215], [900, 60]],
  [[610, 430], [610, 215], [900, 215], [900, 380]],
  [[610, 430], [610, 215], [310, 215], [310, 380]],
  [[610, 430], [610, 215], [60, 215]],
  [[610, 430], [610, 215], [1140, 215]],
];

function routeTimes(route: Array<[number, number]>): number[] {
  const d = [0];
  for (let i = 1; i < route.length; i++) {
    d.push(
      d[i - 1] +
        Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1])
    );
  }
  return d.map((v) => v / d[d.length - 1]);
}

const VISITORS = Array.from({ length: 18 }, (_, i) => {
  const route = ROUTES[i % ROUTES.length];
  // small sideways offset so people don't walk in single file
  const off = ((i * 7) % 5) * 3 - 6;
  return {
    xs: route.map(([x]) => x + off),
    ys: route.map(([, y]) => y + (off * 2) / 3),
    times: routeTimes(route),
    duration: 9 + ((i * 5) % 7),
    delay: (i * 0.47) % 6,
  };
});

const PHASES = [
  {
    label: "Floorplan",
    note: "Twelve months out, the hall is an empty rectangle and a drawing.",
  },
  {
    label: "Sales",
    note: "Space sells. Every stand sold is one that has to be built.",
  },
  {
    label: "Build-up",
    note: "Shell scheme, rigging, stage and signage go in against the clock.",
  },
  {
    label: "Show open",
    note: "Doors open. When the operation is right, nobody notices it.",
  },
  {
    label: "Breakdown",
    note: "Everything comes out and the hall goes back empty, on time.",
  },
] as const;

const AUTO_AT = [1900, 3900, 6000]; // ms after mount: Sales, Build-up, Show open

export default function HallBuild() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 3 : 0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (reduce) {
      setPhase(3);
      return;
    }
    timers.current = AUTO_AT.map((ms, i) => setTimeout(() => setPhase(i + 1), ms));
    return () => timers.current.forEach(clearTimeout);
  }, [reduce]);

  const choose = (i: number) => {
    timers.current.forEach(clearTimeout);
    setPhase(i);
  };

  const gone = phase === 4;
  const sold = phase >= 1 && !gone;
  const built = phase >= 2 && !gone;
  const open = phase === 3;
  const t = (delay: number, duration = 0.6) =>
    reduce ? { duration: 0 } : { delay, duration, ease: "easeInOut" as const };

  return (
    <figure className="hall">
      <figcaption className="hall-caption">
        <ol className="phases">
          {PHASES.map((p, i) => (
            <li key={p.label} className={i <= phase ? "reached" : undefined}>
              <button
                type="button"
                aria-pressed={i === phase}
                onClick={() => choose(i)}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ol>
        <p className="phase-note">{PHASES[phase].note}</p>
      </figcaption>
      <svg
        className="hall-svg"
        viewBox="0 0 1200 430"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        role="img"
        aria-label="Animated plan of an exhibition hall going through a show: floorplan, stand sales, build-up, show open and breakdown."
      >
        {/* hall shell, with the entrance gap at the bottom */}
        <motion.path
          d="M560 410 H20 V20 H1180 V410 H660"
          stroke={INK}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={t(0.1, 1.1)}
        />
        {AISLES.map((a, i) => (
          <motion.line
            key={i}
            {...a}
            stroke={PLAN}
            strokeWidth="1"
            strokeDasharray="3 7"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.5 + i * 0.08, 0.5)}
          />
        ))}

        {/* sold stands */}
        {STANDS.filter((s) => s.sold).map((s, i) => (
          <motion.rect
            key={`sold-${s.id}`}
            x={s.x + 3}
            y={s.y + 3}
            width={s.w - 6}
            height={s.h - 6}
            fill={SOLD}
            initial={false}
            animate={{ opacity: sold ? 0.62 : 0 }}
            transition={t(sold ? i * 0.09 : 0, 0.45)}
          />
        ))}

        {/* stands: drawn as plan lines, inked in when built */}
        {STANDS.map((s, i) => (
          <motion.rect
            key={s.id}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { pathLength: 0, stroke: PLAN, opacity: 1 }}
            animate={{
              pathLength: 1,
              stroke: built ? INK : PLAN,
              opacity: gone ? 0 : 1,
            }}
            transition={{
              pathLength: t(0.5 + i * 0.045, 0.8),
              stroke: t(built ? i * 0.06 : 0, 0.35),
              opacity: t(gone ? i * 0.05 : 0, 0.4),
            }}
          />
        ))}

        {/* stand numbers */}
        <motion.g
          className="hall-labels"
          fontSize="11"
          fill="rgba(255,255,255,0.55)"
          initial={false}
          animate={{ opacity: phase >= 1 && !gone ? 1 : 0 }}
          transition={t(0.2, 0.6)}
        >
          {STANDS.map((s) => (
            <text key={s.id} x={s.x + s.w / 2} y={s.y + s.h / 2 + 4} textAnchor="middle">
              {s.id}
            </text>
          ))}
        </motion.g>

        {/* features that arrive with the build: stage, café, registration */}
        <motion.g
          stroke={INK}
          strokeWidth="1.25"
          initial={false}
          animate={{ opacity: built ? 1 : 0 }}
          transition={t(built ? 0.5 : 0, 0.7)}
        >
          {/* main stage with seating */}
          <rect x="640" y="50" width="230" height="135" vectorEffect="non-scaling-stroke" />
          <rect x="700" y="58" width="110" height="20" fill={INK} stroke="none" />
          {[98, 114, 130, 146, 162].map((y) => (
            <line
              key={y}
              x1="664"
              y1={y}
              x2="846"
              y2={y}
              strokeDasharray="7 5"
              strokeWidth="2.5"
              stroke="rgba(255,255,255,0.45)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* café */}
          <rect x="50" y="245" width="110" height="125" vectorEffect="non-scaling-stroke" />
          {[
            [78, 275], [132, 275], [105, 308], [78, 341], [132, 341],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" vectorEffect="non-scaling-stroke" />
          ))}
          {/* registration desks either side of the entrance */}
          <rect x="470" y="386" width="80" height="12" fill={INK} stroke="none" />
          <rect x="670" y="386" width="80" height="12" fill={INK} stroke="none" />
        </motion.g>
        <motion.g
          className="hall-labels"
          fontSize="11"
          fill="rgba(255,255,255,0.72)"
          initial={false}
          animate={{ opacity: built ? 1 : 0 }}
          transition={t(built ? 0.7 : 0, 0.6)}
        >
          <text x="755" y="72" textAnchor="middle" fill={NAVY}>
            Main stage
          </text>
          <text x="105" y="262" textAnchor="middle">
            Café
          </text>
          <text x="462" y="396" textAnchor="end">
            Registration
          </text>
        </motion.g>

        {/* visitors */}
        {open &&
          VISITORS.map((v, i) =>
            reduce ? (
              <circle key={i} cx={v.xs[2]} cy={v.ys[2]} r="3.4" fill="#ffffff" />
            ) : (
              <motion.circle
                key={i}
                r="3.4"
                fill="#ffffff"
                initial={{ cx: v.xs[0], cy: v.ys[0], opacity: 0 }}
                animate={{
                  cx: v.xs,
                  cy: v.ys,
                  opacity: [0, 1, 1, 0],
                }}
                transition={{
                  cx: { duration: v.duration, times: v.times, ease: "linear", repeat: Infinity, delay: v.delay },
                  cy: { duration: v.duration, times: v.times, ease: "linear", repeat: Infinity, delay: v.delay },
                  opacity: { duration: v.duration, times: [0, 0.06, 0.9, 1], ease: "linear", repeat: Infinity, delay: v.delay },
                }}
              />
            )
          )}

        <text className="hall-labels" x="610" y="426" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.72)">
          Entrance
        </text>
      </svg>

    </figure>
  );
}
