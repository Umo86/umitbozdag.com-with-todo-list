import { db } from "./db";

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const STATUSES = new Set(["todo", "doing", "done"]);
export const PRIORITIES = new Set(["low", "normal", "high"]);

export function cleanTitle(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

export const TASK_COLS = `id, project_id, title, notes, status, priority,
  to_char(due_date, 'YYYY-MM-DD') as due_date, created_at, completed_at`;

const SEED_PROJECTS: Array<[string, string]> = [
  ["UK Construction Week", "#a61c2b"],
  ["umitbozdag.com", "#f2efe9"],
  ["Event Delivery", "#1f6f6b"],
  ["Gezelim", "#b3741f"],
  ["Bizim Event", "#3f5fae"],
  ["ATESP", "#6d3b8e"],
];

export async function seedIfFirstRun(): Promise<void> {
  const r = await db().query(`select value from settings where key = 'seeded'`);
  if (r.rows.length) return;
  for (let i = 0; i < SEED_PROJECTS.length; i++) {
    const [name, color] = SEED_PROJECTS[i];
    await db().query(
      `insert into projects (name, color, position) values ($1, $2, $3)`,
      [name, color, i]
    );
  }
  await db().query(
    `insert into settings (key, value) values ('seeded', 'true')
     on conflict (key) do nothing`
  );
}
