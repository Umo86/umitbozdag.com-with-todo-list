import { db } from "./db";
import { dateByKey, dishByKey, GAME_PREFIX, type Game } from "./dishes";
import { DATE, UUID } from "./backstage";
import type { Me, UserId } from "./auth";

// The fun bits share one table (us_items), told apart by `kind`:
//   countdown  joint   title, day, emoji          "14 days to Istanbul ✈️"
//   memory     joint   title (the moment), day, emoji
//   idea       joint   title, list (date|dinner), emoji
//   shopping   joint   title, body (note/qty), done, done_by
//   gift       private title, body (link/notes), for_user, done  - only its writer sees it
//   mood       joint   emoji, title (note), day  - one per person per day
//   vote       joint   ref (a dinner idea), yes, day - one per person per idea per day

export const US_KINDS = ["countdown", "memory", "idea", "shopping", "gift", "mood", "vote"] as const;
export type UsKind = (typeof US_KINDS)[number];

export const US_COLS = `id, kind, owner, added_by, title, body, to_char(day, 'YYYY-MM-DD') as day, emoji, list, ref, yes,
  done, done_by, for_user, created_at, updated_at`;

/** Today's date in London, YYYY-MM-DD. */
export const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const emoji = (v: unknown) => (typeof v === "string" ? [...v.trim()].slice(0, 4).join("") || null : null);

type Fields = Record<string, unknown>;
type Check = { ok: true; fields: Fields } | { ok: false; error: string };

/** Validates a new item (or an edit when `partial`). */
export function readUs(kind: UsKind, body: Record<string, unknown>, me: Me, partial: boolean): Check {
  const f: Fields = {};
  const has = (k: string) => body[k] !== undefined;
  const need = (k: string) => !partial || has(k);
  const other: UserId = me.id === "umit" ? "dilfiraz" : "umit";

  switch (kind) {
    case "countdown":
      if (need("title")) {
        f.title = text(body.title, 120);
        if (!f.title) return { ok: false, error: "What are you counting down to?" };
      }
      if (need("day")) {
        if (typeof body.day !== "string" || !DATE.test(body.day)) return { ok: false, error: "Pick the date." };
        f.day = body.day;
      }
      if (has("emoji")) f.emoji = emoji(body.emoji);
      break;
    case "memory":
      if (need("title")) {
        f.title = text(body.title, 1000);
        if (!f.title) return { ok: false, error: "Write a line about the moment." };
      }
      if (has("day") || !partial) f.day = typeof body.day === "string" && DATE.test(body.day) ? body.day : londonToday();
      if (has("emoji")) f.emoji = emoji(body.emoji);
      break;
    case "idea":
      if (need("title")) {
        f.title = text(body.title, 120);
        if (!f.title) return { ok: false, error: "Give the idea a name." };
      }
      if (need("list")) {
        if (body.list !== "date" && body.list !== "dinner") return { ok: false, error: "Is it a date idea or a dinner idea?" };
        f.list = body.list;
      }
      if (has("emoji")) f.emoji = emoji(body.emoji);
      break;
    case "shopping":
      if (need("title")) {
        f.title = text(body.title, 120);
        if (!f.title) return { ok: false, error: "What do you need?" };
      }
      if (has("body")) f.body = text(body.body, 200) || null;
      if (has("done")) {
        f.done = body.done === true;
        f.done_by = body.done === true ? me.id : null;
      }
      break;
    case "gift":
      if (need("title")) {
        f.title = text(body.title, 200);
        if (!f.title) return { ok: false, error: "What's the gift idea?" };
      }
      if (has("body")) f.body = text(body.body, 1000) || null;
      if (has("done")) f.done = body.done === true;
      if (!partial) f.for_user = other;
      break;
    case "mood":
      f.emoji = emoji(body.emoji);
      if (!f.emoji) return { ok: false, error: "Pick a mood." };
      f.title = text(body.title, 80);
      f.day = londonToday();
      break;
    case "vote":
      // either one of your own ideas (ref) or a built-in card ("dish:key" / "date:key" in title)
      if (typeof body.ref === "string" && UUID.test(body.ref)) f.ref = body.ref;
      else if (typeof body.title === "string" && /^(?:dish|date):[a-z0-9-]{1,40}$/.test(body.title)) f.title = body.title;
      else return { ok: false, error: "Vote on a card." };
      f.yes = body.yes === true;
      f.day = londonToday();
      break;
  }
  if (!partial) {
    f.kind = kind;
    f.owner = kind === "gift" ? me.id : "joint";
    f.added_by = me.id;
  }
  return { ok: true, fields: f };
}

/** Who may change or delete an item. */
export function canEdit(item: { kind: string; owner: string; added_by: string }, me: Me): boolean {
  if (item.kind === "gift") return item.owner === me.id;
  if (item.kind === "mood" || item.kind === "vote") return item.added_by === me.id;
  return item.owner === "joint";
}

/** Everything fun one person can see, for the state call. */
export async function loadUs(me: Me) {
  const today = londonToday();
  const [items, scores, birthdays] = await Promise.all([
    db().query(
      `select ${US_COLS} from us_items
       where (owner = 'joint' or owner = $1)
         and not (kind = 'shopping' and done and updated_at < now() - interval '2 days')
         and not (kind = 'mood' and day < $2::date - 14)
         and not (kind = 'vote' and day <> $2::date)
       order by created_at desc limit 1500`,
      [me.id, today]
    ),
    // chore battle: joint to-dos ticked off, high priority counts double
    db().query(
      `with wk as (select (date_trunc('week', now() at time zone 'Europe/London') at time zone 'Europe/London') as start)
       select completed_by as who,
         coalesce(sum(case when completed_at >= wk.start then case when priority = 'high' then 2 else 1 end end), 0)::int as this_week,
         coalesce(sum(case when completed_at >= wk.start - interval '7 days' and completed_at < wk.start
                       then case when priority = 'high' then 2 else 1 end end), 0)::int as last_week
       from tasks, wk
       where owner = 'joint' and status = 'done' and completed_by is not null
       group by completed_by`
    ),
    db().query(`select id, to_char(birthday, 'YYYY-MM-DD') as birthday from users`),
  ]);
  return {
    us: items.rows,
    scores: scores.rows as Array<{ who: string; this_week: number; last_week: number }>,
    birthdays: Object.fromEntries(birthdays.rows.map((r) => [r.id, r.birthday])) as Record<string, string | null>,
  };
}

// ——— the swipe games (dinner, dates): what you both said yes to today ———
export type GameMatch = { key: string; title: string; emoji: string; at: string };

/**
 * Today's match in one game: the first card both people said yes to (first by
 * the moment the second yes landed), or null. `key` is the idea's id for one
 * of your own ideas, or "dish:<key>" / "date:<key>" for a built-in card.
 */
export async function gameMatch(game: Game): Promise<GameMatch | null> {
  const r = await db().query(
    `select coalesce(a.ref::text, a.title) as key, a.ref, greatest(a.created_at, b.created_at) as at,
            i.title as idea_title, i.emoji as idea_emoji
       from us_items a
       join us_items b
         on b.kind = 'vote' and b.day = a.day and b.yes and b.added_by > a.added_by
        and coalesce(b.ref::text, b.title) = coalesce(a.ref::text, a.title)
       left join us_items i on i.id = a.ref and i.kind = 'idea'
      where a.kind = 'vote' and a.day = $1::date and a.yes
        and (case when a.ref is null then a.title like $2 else i.list = $3 end)
      order by at asc
      limit 1`,
    [londonToday(), `${GAME_PREFIX[game]}%`, game]
  );
  const m = r.rows[0];
  if (!m) return null;
  const at = new Date(m.at).toISOString();
  if (m.ref) return m.idea_title ? { key: m.key, title: m.idea_title, emoji: m.idea_emoji ?? (game === "dinner" ? "🍽️" : "💘"), at } : null;
  const bare = String(m.key).slice(GAME_PREFIX[game].length);
  const card = game === "dinner" ? dishByKey.get(bare) : dateByKey.get(bare);
  return card ? { key: m.key, title: card.title, emoji: card.emoji, at } : null;
}
