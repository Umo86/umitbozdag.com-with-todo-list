// Schema migration for the Backstage database.
// Idempotent; runs over the DIRECT (non-pooled) connection, per Neon guidance.
// Usage: node scripts/migrate.mjs  (reads .env.local or .env in the project root)
import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  }
}
loadEnv();

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL_UNPOOLED / DATABASE_URL found. Run `neon deploy` or `neon env pull` first.");
  process.exit(1);
}

const DDL = `
create table if not exists settings (
  key   text primary key,
  value text not null
);

create table if not exists projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#a61c2b',
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade,
  title        text not null,
  notes        text,
  status       text not null default 'todo'
               check (status in ('todo','doing','done')),
  priority     text not null default 'normal'
               check (priority in ('low','normal','high')),
  due_date     date,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_status_idx  on tasks (status);
create index if not exists tasks_project_idx on tasks (project_id);
`;

const client = new Client({ connectionString: url });
await client.connect();
await client.query(DDL);
const t = await client.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' order by table_name`
);
console.log("Schema applied. public tables:", t.rows.map((r) => r.table_name).join(", "));
await client.end();
