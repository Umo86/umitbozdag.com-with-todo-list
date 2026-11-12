import { db } from "@/lib/db";
import { TASK_COLS, EVENT_COLS, PROJECT_COLS } from "@/lib/backstage";

export const dynamic = "force-dynamic";

// A read-only calendar feed for one person, for Google / Samsung Calendar:
// their own and the joint events, plus open tasks with a due date and
// project deadlines (as all-day entries). The long random token in the
// address is the only key, so the link should be kept private; a new one
// can be made in Backstage settings.

const RRULE: Record<string, string> = {
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekly: "FREQ=WEEKLY",
  fortnightly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (iso: string | Date) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (ymd: string) => ymd.replace(/-/g, "");
const nextDay = (ymd: string) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};
// lines longer than 75 bytes are folded, as the format requires
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 74) {
      out.push(cur);
      cur = " " + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const u = await db()
    .query(`select id, name from users where calendar_token = $1`, [token])
    .catch(() => ({ rows: [] as Array<{ id: string; name: string }> }));
  const user = u.rows[0];
  if (!user) return new Response("Not found", { status: 404 });

  const [events, tasks, projects, users] = await Promise.all([
    db().query(`select ${EVENT_COLS} from events where owner in ($1, 'joint') or shared`, [user.id]),
    db().query(`select ${TASK_COLS} from tasks where owner in ($1, 'joint') and status <> 'done' and due_date is not null`, [user.id]),
    db().query(`select ${PROJECT_COLS} from projects where owner in ($1, 'joint') and due_date is not null`, [user.id]),
    db().query(`select id, name from users`),
  ]);
  const nameOf = (id: string) => users.rows.find((x) => x.id === id)?.name ?? id;
  const stamp = utc(new Date());
  const L: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//umitbozdag.com//Backstage//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Backstage – ${esc(user.name)}`,
    "X-WR-TIMEZONE:Europe/London",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const e of events.rows) {
    const who = e.owner === "joint" ? "Joint" : nameOf(e.owner);
    L.push("BEGIN:VEVENT", `UID:${e.id}@backstage`, `DTSTAMP:${stamp}`);
    if (e.all_day) {
      L.push(`DTSTART;VALUE=DATE:${day(e.start_date)}`, `DTEND;VALUE=DATE:${nextDay(e.end_date ?? e.start_date)}`);
    } else {
      L.push(`DTSTART:${utc(e.starts_at)}`);
      L.push(`DTEND:${utc(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 3_600_000))}`);
    }
    // the other person's entry, shared with you, carries their name
    L.push(`SUMMARY:${esc((e.owner === "joint" ? "👥 " : e.owner !== user.id ? `${nameOf(e.owner)}: ` : "") + e.title)}`);
    const desc = [e.notes, `${who} · added by ${nameOf(e.added_by)}`].filter(Boolean).join("\n\n");
    L.push(`DESCRIPTION:${esc(desc)}`);
    if (e.location) L.push(`LOCATION:${esc(e.location)}`);
    if (e.repeat && RRULE[e.repeat]) L.push(`RRULE:${RRULE[e.repeat]}`);
    if (e.remind_minutes !== null && e.remind_minutes !== undefined) {
      L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.remind_minutes}M`, "END:VALARM");
    }
    L.push("END:VEVENT");
  }
  for (const t of tasks.rows) {
    L.push(
      "BEGIN:VEVENT",
      `UID:task-${t.id}@backstage`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(t.due_date)}`,
      `DTEND;VALUE=DATE:${nextDay(t.due_date)}`,
      `SUMMARY:${esc("☐ " + t.title)}`,
      `DESCRIPTION:${esc(`To-do${t.owner === "joint" ? " (joint)" : ""}${t.notes ? "\n\n" + t.notes : ""}`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  }
  for (const p of projects.rows) {
    L.push(
      "BEGIN:VEVENT",
      `UID:project-${p.id}@backstage`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(p.due_date)}`,
      `DTEND;VALUE=DATE:${nextDay(p.due_date)}`,
      `SUMMARY:${esc("⚑ " + p.name + " deadline")}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  }
  L.push("END:VCALENDAR");
  return new Response(L.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="backstage-${user.id}.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
