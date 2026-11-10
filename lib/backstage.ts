import { db } from "./db";

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const STATUSES = new Set(["todo", "doing", "done"]);
export const PRIORITIES = new Set(["low", "normal", "high"]);
// The board's two lists. Tasks Claude adds by voice land in these too.
export const LISTS = new Set(["personal", "work"]);

export const COLOR = /^#[0-9a-f]{6}$/i;
export const REPEATS = new Set(["daily", "weekdays", "weekly", "fortnightly", "monthly", "yearly"]);

export function cleanRepeat(v: unknown): string | null {
  return typeof v === "string" && REPEATS.has(v) ? v : null;
}

export const PROJECT_COLS = `id, name, color, position, to_char(due_date, 'YYYY-MM-DD') as due_date`;

export function cleanTitle(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

export function cleanList(v: unknown): string | null {
  return typeof v === "string" && LISTS.has(v) ? v : null;
}

// A reminder time: an ISO 8601 date-time that states its time zone
// ("…Z" or "…+01:00", e.g. from Date.toISOString()). Returned in UTC.
const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;
export function cleanWhen(v: unknown): string | null {
  if (typeof v !== "string" || !ZONED.test(v)) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// Sort key within a column (lower = higher up). Fractions let a card be
// dropped between two others without renumbering the column.
export function cleanPosition(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export const TASK_COLS = `id, project_id, list, title, notes, status, priority,
  to_char(due_date, 'YYYY-MM-DD') as due_date, remind_at, added_by, position,
  calendar_ref, repeat, created_at, updated_at, completed_at`;

export const TASK_ORDER = `order by position asc, created_at desc`;

const SEED_PROJECTS: Array<[string, string]> = [
  ["UK Construction Week", "#a61c2b"],
  ["umitbozdag.com", "#f2efe9"],
  ["Event Delivery", "#1f6f6b"],
  ["Gezelim", "#b3741f"],
  ["Bizim Event", "#3f5fae"],
  ["ATESP", "#6d3b8e"],
];

// Seeds the starter projects exactly once. The 'seeded' row is claimed first,
// so two first visits at the same moment can't both insert the projects.
export async function seedIfFirstRun(): Promise<void> {
  const claimed = await db().query(
    `insert into settings (key, value) values ('seeded', 'true')
     on conflict (key) do nothing returning key`
  );
  if (!claimed.rows.length) return;
  const existing = await db().query(`select 1 from projects limit 1`);
  if (existing.rows.length) return;
  for (let i = 0; i < SEED_PROJECTS.length; i++) {
    const [name, color] = SEED_PROJECTS[i];
    await db().query(
      `insert into projects (name, color, position) values ($1, $2, $3)`,
      [name, color, i]
    );
  }
}
