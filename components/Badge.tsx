"use client";

// A delegate badge on a lanyard. It swings once as it comes into view and
// again when the pointer brushes it.
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { SITE } from "@/lib/content";

// Decorative barcode: widths chosen to look like a badge code, not to scan.
const BARS = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 4, 1, 2, 2, 1, 3, 1, 1, 2, 4, 1, 2];

export default function Badge() {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const swing = (from: number) => {
    if (reduce) return;
    controls.start({
      rotate: [from, -from * 0.6, from * 0.35, -from * 0.15, 0],
      transition: { duration: 2.2, ease: "easeInOut", times: [0, 0.28, 0.55, 0.8, 1] },
    });
  };
  return (
    <motion.div
      className="badge-rig"
      aria-hidden="true"
      animate={controls}
      style={{ transformOrigin: "50% 0%" }}
      onViewportEnter={() => swing(7)}
      onHoverStart={() => swing(4)}
      viewport={{ once: true, margin: "-80px" }}
    >
      <svg className="lanyard" viewBox="0 0 120 110" preserveAspectRatio="none">
        <path d="M8 0 L56 104" />
        <path d="M112 0 L64 104" />
      </svg>
      <span className="badge-clip" />
      <div className="badge-card">
        <div className="badge-band">Organiser</div>
        <div className="badge-body">
          <p className="badge-name">
            Umit
            <br />
            Bozdag
          </p>
          <p className="badge-role">{SITE.role}</p>
          <p className="badge-org">{SITE.employer}</p>
        </div>
        <div className="badge-foot">
          <span className="badge-bars">
            {BARS.map((w, i) => (
              <i key={i} style={{ width: w }} />
            ))}
          </span>
          <span className="badge-access">All areas</span>
        </div>
      </div>
    </motion.div>
  );
}
