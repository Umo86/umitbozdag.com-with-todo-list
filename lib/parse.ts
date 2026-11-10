// Turns what Umit says (or types) into Backstage tasks.
//
//   "call the venue tomorrow at 10 and chase the signage quote for UKCW,
//    book the dentist Friday, remind me Thursday at 6pm"
//
// becomes three drafts with titles, dates, reminders, list, project, priority
// and repeat. Everything is worked out in the device's own time zone; the
// result is a draft the person checks before anything is saved.
//
// Self-contained on purpose (no imports) so it runs in the browser, on the
// server and in plain Node tests.

export type DraftList = "work" | "personal";
export type DraftPriority = "low" | "normal" | "high";
export type Repeat = "daily" | "weekdays" | "weekly" | "fortnightly" | "monthly" | "yearly";

export type DraftAssignee = "umit" | "dilfiraz" | "both";

export type Draft = {
  kind: "task" | "event";
  joint: boolean; // on the joint list / calendar instead of your own
  assignee: DraftAssignee | null; // joint items: who it's for
  start_local: string | null; // events with a time: YYYY-MM-DDTHH:MM, local (day is due_date)
  remind_minutes: number | null; // events: minutes before the start
  title: string;
  list: DraftList | null; // null: whichever list is open
  project_id: string | null;
  priority: DraftPriority;
  due_date: string | null; // YYYY-MM-DD, local
  remind_local: string | null; // YYYY-MM-DDTHH:MM, local
  repeat: Repeat | null;
};

export type ParseOptions = {
  now?: Date;
  projects?: Array<{ id: string; name: string }>;
  /** the other person, so "for Dilfiraz" / "Umit to …" can be understood */
  others?: Array<{ id: "umit" | "dilfiraz"; name: string }>;
};

export const REPEATS: Repeat[] = ["daily", "weekdays", "weekly", "fortnightly", "monthly", "yearly"];
export const REPEAT_LABEL: Record<Repeat, string> = {
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  fortnightly: "Every 2 weeks",
  monthly: "Every month",
  yearly: "Every year",
};

// ---------- dates ----------

const DAY = 86_400_000;
const p2 = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function addMonths(d: Date, n: number): Date {
  const want = d.getMonth() + n;
  const r = new Date(d.getFullYear(), want, 1);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), last));
  return r;
}

/** The next date a repeating task falls on, after `from` (YYYY-MM-DD). */
export function nextOccurrence(from: string, repeat: Repeat): string {
  const d = new Date(from + "T00:00:00");
  switch (repeat) {
    case "daily":
      return ymd(addDays(d, 1));
    case "weekdays": {
      let n = addDays(d, 1);
      while (n.getDay() === 0 || n.getDay() === 6) n = addDays(n, 1);
      return ymd(n);
    }
    case "weekly":
      return ymd(addDays(d, 7));
    case "fortnightly":
      return ymd(addDays(d, 14));
    case "monthly":
      return ymd(addMonths(d, 1));
    case "yearly":
      return ymd(addMonths(d, 12));
  }
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WD = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thur?s?|fri|sat)";
const wdIndex = (w: string) => WEEKDAYS.findIndex((d) => d.startsWith(w.slice(0, 3)));
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MO = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)";
const moIndex = (m: string) => MONTHS.findIndex((x) => x.startsWith(m.slice(0, 3)));

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, "forty five": 45,
  "a couple of": 2, "a couple": 2, couple: 2, "a few": 3, few: 3,
};
const NUM = "(\\d{1,3}|a couple of|a couple|a few|an|a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty five)";
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUMBER_WORDS[s] ?? 1);

/** Monday of the week containing d (weeks run Monday to Sunday). */
const mondayOf = (d: Date) => addDays(atMidnight(d), -((d.getDay() + 6) % 7));

/** The coming `wd` strictly after today. */
function upcoming(today: Date, wd: number): Date {
  const diff = (wd - today.getDay() + 7) % 7 || 7;
  return addDays(today, diff);
}

// ---------- splitting ----------

// Words that usually start a new to-do when someone strings several together
// without punctuation (speech recognisers rarely add any).
const VERBS = [
  "add", "approve", "arrange", "ask", "book", "bring", "buy", "call", "cancel", "change", "chase",
  "check", "clean", "clear", "collect", "confirm", "contact", "create", "do", "draft", "drop",
  "email", "e-mail", "file", "finish", "find", "fix", "follow", "get", "give", "go", "invoice",
  "look", "make", "meet", "message", "move", "order", "organise", "organize", "pay", "phone",
  "pick", "plan", "post", "prepare", "print", "put", "read", "reply", "remind", "renew",
  "research", "respond", "return", "review", "ring", "schedule", "send", "set", "share", "sign",
  "sort", "speak", "start", "submit", "take", "talk", "tell", "text", "tidy", "update", "upload",
  "visit", "wash", "write",
];
const VERB = `(?:${VERBS.join("|")})`;

function splitIntoChunks(text: string, names: string[] = []): string[] {
  const t = text
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .trim();
  if (!t) return [];
  return t
    // sentence ends, semicolons, bullets, new lines
    .split(/(?:[\n;•]|(?<=[.!?])\s+(?=[A-Za-z])|\s+-\s+)+/)
    .flatMap((s) => s.split(/\s*,?\s*\b(?:and then|and also|after that|then|also|plus)\b\s*/i))
    // "... and chase ...", ", book ..."
    .flatMap((s) => s.split(new RegExp(`\\s*(?:,\\s*and|,|\\band)\\s+(?=(?:i need to |i have to |i've got to |need to |to |please |also )?${VERB}\\b)`, "i")))
    // "... and Dilfiraz to book the vet"
    .flatMap((s) =>
      names.length
        ? s.split(new RegExp(`\\s*(?:,\\s*and|,|\\band)\\s+(?=(?:${names.join("|")})\\s+(?:to|needs to|has to|should)\\b)`, "i"))
        : [s]
    )
    .map((s) => s.replace(/^[\s,.\-–—]+|[\s,.\-–—]+$/g, ""))
    .filter(Boolean);
}

// ---------- one chunk ----------

type Found = {
  date: Date | null;
  time: { h: number; m: number } | null;
  remind: boolean;
  remindAt: Date | null; // exact reminder ("in 20 minutes")
  priority: DraftPriority;
  list: DraftList | null;
  projectId: string | null;
  repeat: Repeat | null;
  joint: boolean;
  assignee: DraftAssignee | null;
  calendar: boolean; // said "calendar"
  guessedTime: boolean; // "at 7" with no am/pm
};

// Things that happen at a time (an event), rather than things to get done.
const EVENT_WORDS = /\b(?:meeting|meet(?:ing)? (?:with|up)|dinner|lunch|breakfast|brunch|coffee with|drinks|party|wedding|engagement|appointment|appt|interview|flight|train to|trip|holiday|concert|gig|cinema|movie|theatre|match|class|lesson|session|viewing|catch[ -]up|call with|conference|exhibition|show day|build[ -]up|open day|ceremony|celebration|date night|picnic|bbq|barbecue|visit to|visiting|check[ -]?in|check[ -]?out|doctor'?s|dentist appointment|haircut|gym)\b/i;

const EVENING = /\b(?:dinner|supper|drinks|party|concert|gig|cinema|movie|theatre|date night|bbq|barbecue|wedding|celebration)\b/i;

function extract(
  chunk: string,
  now: Date,
  projects: Array<{ id: string; name: string }>,
  others: Array<{ id: "umit" | "dilfiraz"; name: string }> = []
) {
  const today = atMidnight(now);
  let s = ` ${chunk} `;
  const f: Found = {
    date: null,
    time: null,
    remind: false,
    remindAt: null,
    priority: "normal",
    list: null,
    projectId: null,
    repeat: null,
    joint: false,
    assignee: null,
    calendar: false,
    guessedTime: false,
  };
  // Remove a match from the text and hand back its groups.
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(s);
    if (m) s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length);
    return m;
  };
  const B = "(?<=[\\s,(])"; // word start
  const E = "(?=[\\s,.!?)])"; // word end

  // filler at the start
  for (;;) {
    const before = s;
    s = s.replace(
      /^\s*(?:ok(?:ay)?|right|so|um+|uh+|er+|please|can you|could you|add(?: a)?(?: task)?(?: to)?|new task|to-?do|i need to|i have to|i've got to|i must|i should|need to|have to|don't forget to|do not forget to|remember to|make sure (?:i|to)|note to self)[\s,:]+/i,
      " "
    );
    if (s === before) break;
  }

  // reminders
  if (take(new RegExp(`${B}(?:and |,\\s*)?(?:set (?:a |an )?)?remind(?:er)? me(?: to| about| of)?${E}`, "i")) ||
      take(new RegExp(`${B}(?:with |and |set )?(?:a |an )?reminder${E}`, "i"))) f.remind = true;
  {
    const m = take(new RegExp(`${B}in ${NUM} (min(?:ute)?s?|hours?|hrs?)${E}`, "i"));
    if (m) {
      const n = toNum(m[1].toLowerCase());
      const ms = /^h/i.test(m[2]) ? n * 3_600_000 : n * 60_000;
      f.remindAt = new Date(now.getTime() + ms);
      f.remindAt.setSeconds(0, 0);
      f.remind = true;
    } else if (take(new RegExp(`${B}in half an hour${E}`, "i"))) {
      f.remindAt = new Date(now.getTime() + 30 * 60_000);
      f.remindAt.setSeconds(0, 0);
      f.remind = true;
    }
  }

  // priority
  if (take(new RegExp(`${B}(?:it'?s |this is |mark (?:it |as )?)?(?:urgent(?:ly)?|asap|a\\.s\\.a\\.p\\.?|as soon as possible|high priority|top priority|important|critical)${E}`, "i")))
    f.priority = "high";
  else if (take(new RegExp(`${B}(?:low priority|no rush|whenever|at some point|when i (?:can|get a chance))${E}`, "i")))
    f.priority = "low";

  // joint, and who it's for
  if (take(new RegExp(`${B}(?:on |in |to |for )?(?:the |our )?(?:joint(?: list| calendar)?|shared(?: list| calendar)?|together|for us|for both of us|both of us|for the family|family calendar)${E}`, "i"))) {
    f.joint = true;
    if (!f.assignee) f.assignee = "both";
  }
  for (const o of others) {
    const nm = o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (
      take(new RegExp(`${B}(?:for|ask|tell|remind) ${nm}(?: to)?${E}`, "i")) ||
      take(new RegExp(`^\\s*${nm}(?: needs to| has to| should| to|,)${E}`, "i"))
    ) {
      f.joint = true;
      f.assignee = o.id;
    }
  }
  if (take(new RegExp(`${B}(?:add (?:it )?)?(?:to|in|on|into) (?:the |my |our )?calendar${E}`, "i"))) f.calendar = true;

  // list
  if (take(new RegExp(`${B}(?:(?:on|to|for|in|at) (?:the |my )?work(?: list| task)?|work (?:list|task))${E}`, "i"))) f.list = "work";
  else if (take(new RegExp(`${B}(?:on |to |for |in )?(?:the |my )?(?:personal(?: list| task)?|home list|for home|at home)${E}`, "i"))) f.list = "personal";

  // repeat
  {
    let m: RegExpExecArray | null;
    if (take(new RegExp(`${B}(?:every|each) (?:week ?day|working day)s?${E}|${B}on weekdays${E}`, "i"))) f.repeat = "weekdays";
    else if (take(new RegExp(`${B}(?:every|each) day${E}|${B}daily${E}`, "i"))) f.repeat = "daily";
    else if (take(new RegExp(`${B}(?:every (?:other|two|2) weeks?|fortnightly|every fortnight)${E}`, "i"))) f.repeat = "fortnightly";
    else if ((m = take(new RegExp(`${B}(?:every|each) ${WD}${E}`, "i")))) {
      f.repeat = "weekly";
      const wd = wdIndex(m[1].toLowerCase());
      f.date = wd === today.getDay() ? today : upcoming(today, wd);
    } else if (take(new RegExp(`${B}(?:every|each) week${E}|${B}weekly${E}`, "i"))) f.repeat = "weekly";
    else if (take(new RegExp(`${B}(?:every|each) month${E}|${B}monthly${E}`, "i"))) f.repeat = "monthly";
    else if (take(new RegExp(`${B}(?:every|each) year${E}|${B}(?:yearly|annually)${E}`, "i"))) f.repeat = "yearly";
  }

  // times (before dates, so "at 3" isn't read as the 3rd)
  {
    let m: RegExpExecArray | null;
    const setT = (h: number, mm: number) => {
      if (h >= 0 && h < 24 && mm >= 0 && mm < 60) f.time = { h, m: mm };
    };
    const ampm = (h: number, mer: string | undefined) => {
      if (!mer) return h;
      const pm = /p/i.test(mer);
      if (h === 12) return pm ? 12 : 0;
      return pm ? h + 12 : h;
    };
    if ((m = take(new RegExp(`${B}(?:at |by |from |for )?(\\d{1,2})[:.](\\d{2}) ?(a\\.?m\\.?|p\\.?m\\.?)?${E}`, "i"))))
      setT(ampm(+m[1], m[3]), +m[2]);
    else if ((m = take(new RegExp(`${B}(?:at |by |from |for )?(\\d{1,2}) ?(a\\.?m\\.?|p\\.?m\\.?|o'?clock)${E}`, "i"))))
      setT(/o/i.test(m[2]) ? (+m[1] <= 6 ? +m[1] + 12 : +m[1]) : ampm(+m[1], m[2]), 0);
    else if ((m = take(new RegExp(`${B}(?:at )?half(?: past)? (\\d{1,2})${E}`, "i")))) {
      const h = +m[1];
      setT(h <= 6 ? h + 12 : h, 30);
    } else if ((m = take(new RegExp(`${B}at (\\d{1,2})${E}(?! ?(?:st|nd|rd|th)\\b)`, "i")))) {
      const h = +m[1];
      setT(h >= 1 && h <= 6 ? h + 12 : h, 0);
      f.guessedTime = true;
    } else if (take(new RegExp(`${B}(?:at )?(?:noon|midday|lunch ?time)${E}`, "i"))) setT(12, 0);
    else if (take(new RegExp(`${B}(?:at )?midnight${E}`, "i"))) setT(23, 59);
  }

  // part of the day ("tomorrow morning", "this evening", "tonight")
  {
    let m: RegExpExecArray | null;
    if ((m = take(new RegExp(`${B}(?:in the |this |first thing (?:in the )?)?(morning|afternoon|evening)${E}`, "i")))) {
      const part = m[1].toLowerCase();
      if (!f.time) f.time = part === "morning" ? { h: 9, m: 0 } : part === "afternoon" ? { h: 14, m: 0 } : { h: 18, m: 0 };
      if (/this/i.test(m[0]) && !f.date) f.date = today;
    } else if (take(new RegExp(`${B}tonight${E}`, "i"))) {
      if (!f.time) f.time = { h: 19, m: 0 };
      f.date = today;
    }
  }

  // dates
  if (!f.date) {
    let m: RegExpExecArray | null;
    const pre = "(?:(?:on|by|before|for|due|until|till|from) )?(?:the )?";
    if (take(new RegExp(`${B}${pre}day after tomorrow${E}`, "i"))) f.date = addDays(today, 2);
    else if (take(new RegExp(`${B}${pre}(?:tomorrow|tmrw|tmr)${E}`, "i"))) f.date = addDays(today, 1);
    else if (take(new RegExp(`${B}${pre}today${E}`, "i"))) f.date = today;
    else if ((m = take(new RegExp(`${B}in ${NUM} (days?|weeks?|months?)${E}`, "i")))) {
      const n = toNum(m[1].toLowerCase());
      f.date = /^d/i.test(m[2]) ? addDays(today, n) : /^w/i.test(m[2]) ? addDays(today, 7 * n) : addMonths(today, n);
    } else if (take(new RegExp(`${B}in a fortnight${E}`, "i"))) f.date = addDays(today, 14);
    else if ((m = take(new RegExp(`${B}${pre}next ${WD}${E}`, "i")))) {
      f.date = addDays(mondayOf(addDays(mondayOf(today), 7)), (wdIndex(m[1].toLowerCase()) + 6) % 7);
    } else if ((m = take(new RegExp(`${B}${pre}(?:this (?:coming )?|coming )?${WD}${E}`, "i")))) {
      const wd = wdIndex(m[1].toLowerCase());
      f.date = /this/i.test(m[0]) && wd === today.getDay() ? today : upcoming(today, wd);
    } else if (take(new RegExp(`${B}${pre}(?:end of (?:the |this )?week|this week)${E}`, "i"))) {
      f.date = today.getDay() === 6 || today.getDay() === 0 ? upcoming(today, 5) : addDays(mondayOf(today), 4);
    } else if (take(new RegExp(`${B}${pre}(?:this |the )?weekend${E}`, "i"))) {
      f.date = today.getDay() === 6 ? today : today.getDay() === 0 ? today : upcoming(today, 6);
    } else if (take(new RegExp(`${B}${pre}next week${E}`, "i"))) f.date = addDays(mondayOf(today), 7);
    else if (take(new RegExp(`${B}${pre}end of (?:the |this )?month${E}`, "i")))
      f.date = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    else if (take(new RegExp(`${B}${pre}next month${E}`, "i")))
      f.date = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    else if ((m = take(new RegExp(`${B}${pre}(\\d{4})-(\\d{2})-(\\d{2})${E}`, "i"))))
      f.date = new Date(+m[1], +m[2] - 1, +m[3]);
    else if (
      (m = take(new RegExp(`${B}${pre}(\\d{1,2})(?:st|nd|rd|th)?(?: of)? ${MO}(?: (\\d{4}))?${E}`, "i"))) ||
      (m = take(new RegExp(`${B}${pre}${MO} (?:the )?(\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?${E}`, "i")))
    ) {
      const dayFirst = /^\d/.test(m[1]);
      const day = +(dayFirst ? m[1] : m[2]);
      const mon = moIndex((dayFirst ? m[2] : m[1]).toLowerCase());
      let d = new Date(m[3] ? +m[3] : today.getFullYear(), mon, day);
      if (!m[3] && d < today) d = new Date(today.getFullYear() + 1, mon, day);
      if (d.getDate() === day) f.date = d;
    } else if ((m = take(new RegExp(`${B}${pre}(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?${E}`, "i")))) {
      // UK order: day/month
      const yr = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : today.getFullYear();
      let d = new Date(yr, +m[2] - 1, +m[1]);
      if (!m[3] && d < today) d = new Date(yr + 1, +m[2] - 1, +m[1]);
      if (d.getDate() === +m[1]) f.date = d;
    } else if ((m = take(new RegExp(`${B}(?:on |by )the (\\d{1,2})(?:st|nd|rd|th)${E}`, "i")))) {
      const day = +m[1];
      let d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day);
      if (d.getDate() === day) f.date = d;
    }
  }

  // project: longest name first; also matches spelt-out letters ("u k c w")
  if (projects.length) {
    const squash = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
    const lettersJoined = s.replace(/\b([a-z])(?: ([a-z]))+\b/gi, (w) => w.replace(/ /g, ""));
    const sorted = [...projects].sort((a, b) => b.name.length - a.name.length);
    for (const pr of sorted) {
      const name = pr.name.trim();
      if (!name) continue;
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const re = new RegExp(`${B}(?:(?:for|on|re|about|under|to) )?(?:the )?${esc}(?:'s)?(?: project| list)?${E}`, "i");
      if (re.test(s)) {
        take(re);
        f.projectId = pr.id;
        break;
      }
      const sq = squash(name);
      if (sq.length >= 3) {
        const re2 = new RegExp(`${B}(?:(?:for|on|re|about|under|to) )?(?:the )?${sq}(?: project)?${E}`, "i");
        if (re2.test(lettersJoined)) {
          s = lettersJoined;
          take(re2);
          f.projectId = pr.id;
          break;
        }
      }
    }
  }

  // tidy the title
  let title = s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/^[\s,.:;\-–—]+|[\s,:;\-–—]+$/g, "")
    .replace(/[.!?]+$/, "");
  for (;;) {
    const before = title;
    title = title
      .replace(/^(?:to|and|then|also|that|i|please)\s+/i, "")
      .replace(/\s+(?:on|by|at|for|in|the|to|and|before|until|due|from|with|of|it|please)$/i, "")
      .replace(/,$/, "")
      .trim();
    if (title === before) break;
  }
  if (title) title = title[0].toUpperCase() + title.slice(1);
  return { title, f };
}

// Clearly personal things, when the list wasn't said.
const PERSONAL = /\b(?:dentist|doctor|gp|hospital|optician|haircut|barber|gym|mum|mom|dad|mother|father|wife|husband|girlfriend|boyfriend|fianc[eé]e?|family|kids?|birthday|anniversary|rent|mortgage|council tax|groceries|milk|bread|shopping|car|mot|insurance|pension|bank|passport|holiday|flight home|cleaner|laundry|bins?)\b/i;

function toDraft(title: string, found: Found, now: Date): Draft {
  let f = found;
  const today = atMidnight(now);
  let date = f.date;
  let remind: Date | null = f.remindAt;
  const isEvent = f.calendar || (EVENT_WORDS.test(title) && !!(f.time || f.date));

  if (isEvent) {
    // "dinner at 7" is in the evening
    if (f.time && f.guessedTime && f.time.h >= 7 && f.time.h <= 11 && EVENING.test(title)) {
      f = { ...f, time: { h: f.time.h + 12, m: f.time.m } };
    }
    let start: Date | null = null;
    if (f.time) {
      const base = date ?? today;
      start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), f.time.h, f.time.m);
      if (!date && start.getTime() <= now.getTime()) start = new Date(start.getTime() + DAY);
      date = atMidnight(start);
    }
    if (!date) date = f.repeat ? today : addDays(today, 1);
    return {
      kind: "event",
      joint: f.joint,
      assignee: f.joint ? f.assignee ?? "both" : null,
      start_local: start ? `${ymd(start)}T${p2(start.getHours())}:${p2(start.getMinutes())}` : null,
      remind_minutes: start ? 30 : null,
      title,
      list: null,
      project_id: f.projectId,
      priority: f.priority,
      due_date: ymd(date),
      remind_local: null,
      repeat: f.repeat,
    };
  }

  if (!remind && f.time) {
    const base = date ?? today;
    remind = new Date(base.getFullYear(), base.getMonth(), base.getDate(), f.time.h, f.time.m);
    // "at 9" said at 10:00 with no day means tomorrow
    if (!date && remind.getTime() <= now.getTime()) {
      remind = new Date(remind.getTime() + DAY);
    }
  }
  if (!remind && f.remind) {
    if (date) remind = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0);
    else {
      // "remind me to …" with no time: this evening, or tomorrow morning if it's late
      remind =
        now.getHours() < 17
          ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0)
          : new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 9, 0);
    }
  }
  if (!date && remind && (f.time || f.remind)) date = atMidnight(remind);
  if (!date && f.repeat) date = today;

  return {
    kind: "task",
    joint: f.joint,
    assignee: f.joint ? f.assignee ?? "both" : null,
    start_local: null,
    remind_minutes: null,
    title,
    list: f.list ?? (!f.projectId && PERSONAL.test(title) ? "personal" : null),
    project_id: f.projectId,
    priority: f.priority,
    due_date: date ? ymd(date) : null,
    remind_local: remind ? `${ymd(remind)}T${p2(remind.getHours())}:${p2(remind.getMinutes())}` : null,
    repeat: f.repeat,
  };
}

/** Read free text (spoken or typed) as one or more task drafts. */
export function parseTasks(text: string, opts: ParseOptions = {}): Draft[] {
  const now = opts.now ?? new Date();
  const projects = opts.projects ?? [];
  const drafts: Draft[] = [];
  for (const chunk of splitIntoChunks(text, (opts.others ?? []).map((o) => o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))) {
    const { title, f } = extract(chunk, now, projects, opts.others);
    const bare = !title || /^(?:it|that|this|about (?:it|that)|me)$/i.test(title);
    const prev = drafts[drafts.length - 1];
    if (bare && prev) {
      // "…, remind me Thursday at 6pm" belongs to the task before it
      const extra = toDraft(prev.title, { ...f, remind: f.remind || !!f.time || !!f.date }, now);
      if (extra.remind_local) prev.remind_local = extra.remind_local;
      if (!prev.due_date && extra.due_date) prev.due_date = extra.due_date;
      if (f.priority !== "normal") prev.priority = f.priority;
      if (f.list) prev.list = f.list;
      if (f.projectId) prev.project_id = f.projectId;
      if (f.repeat) prev.repeat = f.repeat;
      if (f.joint) {
        prev.joint = true;
        prev.assignee = f.assignee ?? "both";
      }
      continue;
    }
    if (bare) continue;
    drafts.push(toDraft(title.slice(0, 200), f, now));
  }
  return drafts;
}

/** "2026-11-12T18:00" (device time) → ISO string, or null. */
export function localToIso(local: string | null): string | null {
  if (!local) return null;
  const t = new Date(local).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
