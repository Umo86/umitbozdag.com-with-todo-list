"use client";

// The hero graphic: an exhibition floorplan that draws itself in hairlines,
// then a handful of stands sell out in carmine. Gentle pointer parallax.
import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

type Stand = {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  sold?: boolean;
};

const STANDS: Stand[] = [
  { x: 80, y: 70, w: 180, h: 90, label: "A10" },
  { x: 80, y: 180, w: 85, h: 80, label: "A12" },
  { x: 175, y: 180, w: 85, h: 80 },
  { x: 340, y: 70, w: 120, h: 90, label: "B20" },
  { x: 470, y: 70, w: 100, h: 90, label: "B24", sold: true },
  { x: 340, y: 180, w: 230, h: 80, label: "B30", sold: true },
  { x: 660, y: 70, w: 100, h: 190, label: "C10" },
  { x: 770, y: 70, w: 110, h: 90, label: "C14" },
  { x: 770, y: 180, w: 110, h: 80 },
  { x: 940, y: 70, w: 180, h: 90, label: "D10" },
  { x: 940, y: 180, w: 180, h: 80, label: "D16", sold: true },
  { x: 80, y: 320, w: 180, h: 80, label: "A40" },
  { x: 80, y: 410, w: 180, h: 80, label: "A44", sold: true },
  { x: 340, y: 320, w: 230, h: 80, label: "B44" },
  { x: 340, y: 410, w: 100, h: 80, label: "B48" },
  { x: 470, y: 410, w: 100, h: 80 },
  { x: 660, y: 320, w: 110, h: 170, label: "C40", sold: true },
  { x: 780, y: 320, w: 100, h: 80, label: "C44" },
  { x: 780, y: 410, w: 100, h: 80 },
  { x: 940, y: 320, w: 180, h: 80, label: "D40" },
  { x: 940, y: 410, w: 85, h: 80 },
  { x: 1035, y: 410, w: 85, h: 80, label: "D46" },
];

const AISLES = [
  { x1: 300, y1: 60, x2: 300, y2: 500 },
  { x1: 620, y1: 60, x2: 620, y2: 500 },
  { x1: 910, y1: 60, x2: 910, y2: 500 },
  { x1: 50, y1: 290, x2: 1150, y2: 290 },
];

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { delay: 0.25 + i * 0.045, duration: 0.9, ease: "easeInOut" as const },
      opacity: { delay: 0.25 + i * 0.045, duration: 0.01 },
    },
  }),
};

export default function Floorplan() {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 20 });
  const sy = useSpring(my, { stiffness: 50, damping: 20 });
  const px = useTransform(sx, (v) => v * 10);
  const py = useTransform(sy, (v) => v * 7);

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      mx.set((e.clientX / window.innerWidth) * 2 - 1);
      my.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduce, mx, my]);

  const soldDelayBase = 2.1;
  let soldIndex = 0;

  return (
    <motion.div
      className="hero-plan"
      aria-hidden="true"
      style={reduce ? undefined : { x: px, y: py }}
    >
      <svg viewBox="0 0 1200 560" fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.g
          stroke="var(--plan-line)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
          initial={reduce ? false : "hidden"}
          animate="show"
        >
          {/* hall boundary */}
          <motion.rect
            x="40"
            y="30"
            width="1120"
            height="500"
            variants={draw}
            custom={0}
          />
          {/* aisles */}
          {AISLES.map((a, i) => (
            <motion.line
              key={`aisle-${i}`}
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              strokeDasharray="3 6"
              variants={draw}
              custom={1 + i}
            />
          ))}
          {/* stands */}
          {STANDS.map((s, i) => (
            <motion.rect
              key={`stand-${i}`}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              variants={draw}
              custom={5 + i}
            />
          ))}
        </motion.g>

        {/* sold stands fill in after the plan is drawn */}
        {STANDS.filter((s) => s.sold).map((s) => {
          const d = soldDelayBase + soldIndex++ * 0.4;
          return (
            <motion.rect
              key={`sold-${s.label}`}
              x={s.x + 3}
              y={s.y + 3}
              width={s.w - 6}
              height={s.h - 6}
              fill="var(--carmine)"
              initial={reduce ? { opacity: 0.16 } : { opacity: 0 }}
              animate={{ opacity: 0.16 }}
              transition={reduce ? { duration: 0 } : { delay: d, duration: 0.6 }}
            />
          );
        })}

        {/* stand labels */}
        <motion.g
          fontFamily="Jost, sans-serif"
          fontSize="12"
          fill="#9a948a"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 1.9, duration: 0.8 }}
        >
          {STANDS.filter((s) => s.label).map((s) => (
            <text
              key={`label-${s.label}`}
              x={s.x + s.w / 2}
              y={s.y + s.h / 2 + 4}
              textAnchor="middle"
            >
              {s.label}
            </text>
          ))}
        </motion.g>
      </svg>
    </motion.div>
  );
}
