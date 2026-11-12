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
-- Wedding planning: a to-do or event marked for the wedding is always joint
alter table tasks  add column if not exists wedding boolean not null default false;
alter table events add column if not exists wedding boolean not null default false;
-- the wedding's details, and the areas the planning is split into
create table if not exists wedding_plan (
  id int primary key default 1 check (id = 1),
  wedding_date date, venue text, capacity int, guests_umit int, guests_dilfiraz int,
  budget numeric(12,2), event_id uuid, seeded boolean not null default false,
  updated_at timestamptz not null default now(), updated_by text
);
create table if not exists wedding_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null, emoji text, position int not null default 0,
  budget numeric(12,2), spent numeric(12,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table tasks add column if not exists area_id uuid;
-- who last changed it, so the other person's app can say "Dilfiraz ticked off …"
alter table tasks add column if not exists updated_by   text;

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

alter table messages add column if not exists meta jsonb;
alter table messages add column if not exists phone text;

-- Wrong Backstage passwords, counted per address to slow guessing.
create table if not exists login_attempts (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_ip_at_idx on login_attempts (ip, at);

-- Repeating tasks (next_id links a finished one to the copy it created)
-- and project deadlines.
alter table tasks    add column if not exists repeat   text;
alter table tasks    add column if not exists next_id  uuid;
alter table projects add column if not exists due_date date;

-- Two people (Nov 2026): Umit and Dilfiraz. Passwords are hashed; set them
-- with scripts/set-password.mjs. Tasks, projects and events belong to one
-- person or to both ('joint').
create table if not exists users (
  id             text primary key,
  name           text not null,
  color          text not null,
  admin          boolean not null default false,
  password_hash  text,
  calendar_token text unique,
  created_at     timestamptz not null default now()
);
insert into users (id, name, color, admin) values
  ('umit', 'Umit', '#1a47ff', true), ('dilfiraz', 'Dilfiraz', '#e0457b', false)
  on conflict (id) do nothing;

alter table tasks    add column if not exists owner    text not null default 'umit';
alter table tasks    add column if not exists assignee text;
alter table projects add column if not exists owner    text not null default 'umit';

-- A project is Work or Personal, like a task. Projects that existed before
-- this take the list most of their tasks are in (Work if they have none).
alter table projects add column if not exists list text check (list in ('personal','work'));
update projects p set list = coalesce(
    (select t.list from tasks t where t.project_id = p.id and t.owner <> 'joint'
      group by t.list order by count(*) desc, t.list desc limit 1), 'work')
  where p.list is null;
alter table projects alter column list set default 'work';
alter table projects alter column list set not null;

-- A calendar entry of your own can be a Work one. The Work side of Backstage
-- shows only those; everything that existed before stays on the Personal side.
alter table events add column if not exists work boolean not null default false;
-- "Who can see it": one of your own entries that the other person can see
-- (but not change) on their calendar. Joint entries are seen by both anyway.
alter table events add column if not exists shared boolean not null default false;
create index if not exists tasks_owner_idx on tasks (owner);

create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  owner          text not null,
  assignee       text,
  added_by       text not null,
  title          text not null,
  notes          text,
  location       text,
  all_day        boolean not null default false,
  starts_at      timestamptz,
  ends_at        timestamptz,
  start_date     date,
  end_date       date,
  remind_minutes int,
  repeat         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists events_owner_idx on events (owner);

-- Chat between the two of them.
create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  sender     text not null,
  body       text not null,
  kind       text not null default 'text',
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists chat_messages_created_idx on chat_messages (created_at);

-- The fun bits (Nov 2026): countdowns, memories, date/dinner ideas and
-- votes, shopping list, gift ideas (private), daily moods - one table, by kind.
create table if not exists us_items (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  owner      text not null,
  added_by   text not null,
  title      text not null default '',
  body       text,
  day        date,
  emoji      text,
  list       text,
  ref        uuid,
  yes        boolean,
  done       boolean not null default false,
  done_by    text,
  for_user   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists us_items_kind_idx on us_items (kind, owner);
alter table tasks add column if not exists love_note    text;
alter table tasks add column if not exists completed_by text;
alter table tasks add column if not exists nudges       int not null default 0;
alter table users add column if not exists birthday     date;

-- Notifications without Firebase: browsers subscribe with Web Push (VAPID
-- keys in VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). (devices: kept for a
-- future Android background check.)
create table if not exists push_subs (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
-- New versions: each changelog entry is announced once to both people.
create table if not exists app_announcements (
  title      text primary key,
  created_at timestamptz not null default now()
);
-- A one-time video from one person to the other: stored in pieces, deleted
-- once it has been watched.
create table if not exists videos (
  id         uuid primary key default gen_random_uuid(),
  from_user  text not null,
  to_user    text not null,
  mime       text not null,
  size       bigint not null,
  chunks     int not null,
  note       text,
  ready      boolean not null default false,
  created_at timestamptz not null default now(),
  opened_at  timestamptz,
  watched_at timestamptz
);
create table if not exists video_chunks (
  video_id uuid not null references videos(id) on delete cascade,
  idx      int not null,
  data     bytea not null,
  primary key (video_id, idx)
);
-- Phones with the Android app, for push notifications (Firebase Cloud
-- Messaging). One row per installed app; the token is Firebase's address for it.
create table if not exists fcm_tokens (
  token      text primary key,
  user_id    text not null,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists fcm_tokens_user_idx on fcm_tokens (user_id);
create table if not exists devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen  timestamptz
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
