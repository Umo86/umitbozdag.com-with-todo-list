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

-- Board: Personal / Work lists, reminders, who added a task, card order,
-- and the id of the matching calendar event once one is made.
alter table tasks add column if not exists list text not null default 'personal'
  check (list in ('personal','work'));
alter table tasks add column if not exists remind_at    timestamptz;
alter table tasks add column if not exists added_by     text not null default 'umit';
alter table tasks add column if not exists position     double precision not null default 0;
alter table tasks add column if not exists calendar_ref text;
alter table tasks add column if not exists updated_at   timestamptz not null default now();

create index if not exists tasks_list_status_idx on tasks (list, status, position);

-- Deleting a project keeps its tasks (they just lose the project label).
alter table tasks drop constraint if exists tasks_project_id_fkey;
alter table tasks add constraint tasks_project_id_fkey
  foreign key (project_id) references projects(id) on delete set null;

-- Messages sent through the public contact form, read in Backstage.
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  company    text,
  message    text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
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
