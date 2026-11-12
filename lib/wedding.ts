import { db } from "./db";

// Wedding planning (always joint: both people see and change all of it).
// - wedding_plan: one row with the date, the venue, the capacity and how many
//   of its places each side has, and the overall budget
// - wedding_guests: the guest lists, one line per guest (or couple, or
//   family), on one side or the other, with who added it
// - wedding_areas: the areas the planning is split into (Venue, Catering,
//   Decor…), each with its own budget and what has been spent so far;
//   a wedding to-do can belong to one (tasks.area_id)

export type WeddingPlan = {
  wedding_date: string | null; // YYYY-MM-DD
  venue: string | null;
  capacity: number | null;
  guests_umit: number | null;
  guests_dilfiraz: number | null;
  budget: number | null;
  event_id: string | null; // the wedding day's own entry on the joint calendar
};
export type WeddingArea = { id: string; name: string; emoji: string | null; position: number; budget: number | null; spent: number | null; added_by: string | null };
export type WeddingGuest = { id: string; side: "umit" | "dilfiraz"; name: string; people: number; added_by: string; created_at: string };
export const GUESTS_MAX = 3000;
export const GUEST_PEOPLE_MAX = 50;

/**
 * One typed line of a guest list. "Ali Demir" is one person; "Ali Demir +1"
 * is two; "Kaya family x4", "Kaya family (4)" and "Kaya family 4" are four.
 */
export function parseGuestLine(line: string): { name: string; people: number } | null {
  let name = line.replace(/[\u0000-\u001f]/g, " ").replace(/^\s*(?:[-*•–]|\d{1,4}[.)])\s+/, "").replace(/\s+/g, " ").replace(/[,;.]+$/, "").trim();
  if (!name) return null;
  let people = 1;
  const plus = /\s*\+\s*(\d{1,2})$/.exec(name);
  const times = /(?:\s+[x×]\s*(\d{1,2})|\s*\((\d{1,2})\)|\s+(\d{1,2}))$/i.exec(name);
  if (plus) {
    people = 1 + Number(plus[1]);
    name = name.slice(0, plus.index).trim();
  } else if (times) {
    people = Number(times[1] ?? times[2] ?? times[3]);
    name = name.slice(0, times.index).trim();
  }
  name = name.replace(/[,;]+$/, "").trim().slice(0, 120);
  if (!name) return null;
  return { name, people: Math.min(GUEST_PEOPLE_MAX, Math.max(1, people)) };
}

import { DEFAULT_AREAS } from "./wedding-starter";
export { DEFAULT_AREAS, STARTER } from "./wedding-starter";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** The plan and its areas. The first time, the usual areas are created. */
export async function readWedding(): Promise<{ plan: WeddingPlan; areas: WeddingArea[]; guests: WeddingGuest[] }> {
  const pool = db();
  let p = (await pool.query(`select to_char(wedding_date, 'YYYY-MM-DD') as wedding_date, venue, capacity, guests_umit, guests_dilfiraz, budget, event_id, seeded from wedding_plan where id = 1`)).rows[0];
  if (!p?.seeded) {
    // "on conflict" makes two first visits at once harmless
    const made = await pool.query(`insert into wedding_plan (id, seeded) values (1, true) on conflict (id) do update set seeded = true where wedding_plan.seeded = false returning id`);
    if (made.rowCount) {
      const values = DEFAULT_AREAS.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, ${i})`).join(", ");
      await pool.query(`insert into wedding_areas (emoji, name, position) values ${values}`, DEFAULT_AREAS.flat());
    }
    p = p ?? { wedding_date: null, venue: null, capacity: null, guests_umit: null, guests_dilfiraz: null, budget: null, event_id: null };
  }
  const [a, g] = await Promise.all([
    pool.query(`select id, name, emoji, position, budget, spent, added_by from wedding_areas order by position, created_at`),
    pool.query(`select id, side, name, people, added_by, created_at from wedding_guests order by seq`),
  ]);
  return {
    plan: { wedding_date: p.wedding_date ?? null, venue: p.venue ?? null, capacity: p.capacity ?? null, guests_umit: p.guests_umit ?? null, guests_dilfiraz: p.guests_dilfiraz ?? null, budget: num(p.budget), event_id: p.event_id ?? null },
    areas: a.rows.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, position: r.position, budget: num(r.budget), spent: num(r.spent), added_by: r.added_by ?? null })),
    guests: g.rows,
  };
}

/** A whole number of people from 0 to 100,000, or null for "not set". */
export const cleanCount = (v: unknown): number | null | undefined => {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 100_000 ? n : undefined;
};
/** An amount of money from 0 to 100 million, to the penny, or null. */
export const cleanMoney = (v: unknown): number | null | undefined => {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[£,\s]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? Math.round(n * 100) / 100 : undefined;
};
