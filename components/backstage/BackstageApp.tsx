"use client";

// Backstage: Umit and Dilfiraz's planner. Today, each person's own to-do
// lists (Work, Personal), the joint list, and a shared calendar. On a phone
// the sections sit in a bottom tab bar; inside the Android app it also keeps
// the phone's reminders in step and handles the back button (see native.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseTask, ymd } from "@/lib/parse";
import Board, { dragState } from "./Board";
import Calendar from "./Calendar";
import UsHub, { nextSaturday, type UsSection } from "./UsHub";
import WeddingView from "./Wedding";
import Shopping from "./Shopping";
import { MatchAlert, lastWeekChampion, MOODS, nextYearly, type GameMatch } from "./Fun";
import { VideoGift, VideoSender, VideoWaiting, type VideoIn, type VideoOut } from "./OneTimeVideo";
import { Help, shouldWelcome, Welcome, WhatsNew, shouldShowNew } from "./Help";
import Dashboard from "./Dashboard";
import EventSheet from "./EventSheet";
import Gate from "./Gate";
import Messages from "./Messages";
import NewTask from "./NewTask";
import Projects from "./Projects";
import Settings from "./Settings";
import TaskDrawer from "./TaskDrawer";
import TaskList from "./TaskList";
import { enablePush, pushState } from "./push";
import { BUZZ, buzz, isApp, listen, prepareNotifications, registerPush, syncReminders, type Extra, type NotificationAction } from "./native";
import { forMe, nameOf, type WeddingTab, type Assignee, type ChatMessage, type ListName, type Space } from "./types";
import { useBackstage } from "./useBackstage";

type View = "today" | "mine" | "joint" | "wedding" | "calendar" | "us" | "messages";
type Sheet =
  | { kind: "task"; id: string }
  | { kind: "event"; id?: string; day?: string; preset?: { title: string; time: string; joint?: boolean; wedding?: boolean } }
  | { kind: "new-task" }
  | { kind: "projects" }
  | { kind: "settings" }
  | { kind: "help" }
  | { kind: "welcome" }
  | { kind: "whatsnew" };

const SPACE_KEY = "backstage:space";
// what each side of Backstage holds: Work shows nothing personal
const WORK_VIEWS: View[] = ["today", "mine", "calendar"];
const PERSONAL_ONLY: View[] = ["joint", "wedding", "us", "messages"];
const VIEW_KEY = "backstage:view";
const SEEN_KEY = "backstage:reminded";

function recall<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function remember(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window: carry on without it */
  }
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

export default function BackstageApp() {
  const bs = useBackstage();
  const { phase, me, tasks, projects, events, users } = bs;
  const narrow = useNarrow();
  const [viewState, setViewState] = useState<View>("today");
  // Two sides: Work and Personal. It starts on Work, so nothing personal can
  // flash up on an office screen before this device's own choice is read.
  const [space, setSpaceState] = useState<Space>("work");
  const spaceRef = useRef<Space>("work");
  spaceRef.current = space;
  const list: ListName = space;
  // Joint, Wedding, Us and Messages can never show on the Work side
  const view: View = space === "work" && !WORK_VIEWS.includes(viewState) ? "today" : viewState;
  const [project, setProject] = useState<string | null>(null);
  const [jointFor, setJointFor] = useState<"all" | "me" | "other">("all");
  const [wedTab, setWedTab] = useState<WeddingTab>("todos"); // Wedding: to-dos, its calendar, or the guest names
  const [wedArea, setWedArea] = useState<string | null>(null); // the wedding area being looked at
  const [jointTab, setJointTab] = useState<"todos" | "shopping">("todos");
  const [usSection, setUsSection] = useState<UsSection>("chat");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [due, setDue] = useState<string[]>([]);
  const seen = useRef<Set<string>>(new Set());

  const setView = useCallback((v: View) => {
    // Joint, Wedding, Us and Messages only exist on the Personal side
    if (PERSONAL_ONLY.includes(v) && spaceRef.current !== "personal") {
      setSpaceState("personal");
      remember(SPACE_KEY, "personal");
    }
    setViewState(v);
    remember(VIEW_KEY, v);
    window.scrollTo({ top: 0 });
  }, []);
  /** Switch side. Anything that only exists on the other side closes. */
  const setSpace = useCallback((sp: Space) => {
    setSpaceState(sp);
    remember(SPACE_KEY, sp);
    setProject(null);
    setSheet(null);
    setViewState((v) => {
      const next = sp === "work" && !WORK_VIEWS.includes(v) ? "today" : v;
      remember(VIEW_KEY, next);
      return next;
    });
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    // this device's side: a browser starts on Work, the phone app on Personal
    let sp = recall<Space | null>(SPACE_KEY, null);
    if (sp !== "work" && sp !== "personal") sp = isApp() ? "personal" : "work";
    let v = recall<View>(VIEW_KEY, "today");
    if (!["today", "mine", "joint", "wedding", "calendar", "us", "messages"].includes(v)) v = "today";
    seen.current = new Set(recall<string[]>(SEEN_KEY, []));
    const q = new URLSearchParams(window.location.search);
    if (q.has("capture") || q.has("add")) setSheet({ kind: "new-task" });
    const qv = q.get("view");
    if (qv && ["today", "mine", "joint", "wedding", "calendar", "us"].includes(qv)) {
      v = qv as View;
      if (PERSONAL_ONLY.includes(v)) sp = "personal"; // a notification about something personal was tapped
    }
    if (sp === "work" && !WORK_VIEWS.includes(v)) v = "today";
    setSpaceState(sp);
    setViewState(v);
    if (q.has("view") || q.has("capture") || q.has("add")) window.history.replaceState(null, "", "/backstage");
  }, []);

  // ——— in-page reminders (browser): check every half minute ———
  useEffect(() => {
    if (phase.kind !== "app" || !me || isApp()) return;
    const check = () => {
      const now = Date.now();
      const fresh = tasks.filter(
        (t) =>
          forMe(t.owner, t.assignee, me.id) &&
          (space === "personal" || (t.owner === me.id && t.list === "work")) &&
          t.remind_at &&
          t.status !== "done" &&
          new Date(t.remind_at).getTime() <= now &&
          !seen.current.has(`${t.id}|${t.remind_at}`)
      );
      if (!fresh.length) return;
      fresh.forEach((t) => {
        seen.current.add(`${t.id}|${t.remind_at}`);
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Backstage reminder", { body: t.title, tag: t.id });
          } catch {
            /* some browsers only allow this from a service worker */
          }
        }
      });
      remember(SEEN_KEY, [...seen.current].slice(-300));
      setDue((d) => [...new Set([...d, ...fresh.map((t) => t.id)])]);
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [phase.kind, tasks, me, space]);

  // ——— the Android app: phone reminders, notification buttons, shortcuts, back ———
  const live = useRef({ tasks, events, sheet, view, usSection: "chat" as string, patchTask: bs.patchTask, refresh: bs.refresh });
  live.current = { tasks, events, sheet, view, usSection, patchTask: bs.patchTask, refresh: bs.refresh };

  const onNotification = useCallback((a: NotificationAction) => {
    const t = a.taskId ? live.current.tasks.find((x) => x.id === a.taskId) : undefined;
    const ev = a.eventId ? live.current.events.find((e) => e.id === a.eventId) : undefined;
    // a tapped reminder opens on the side it belongs to
    const side = (sp: Space) => {
      setSpaceState(sp);
      remember(SPACE_KEY, sp);
    };
    if (a.action === "done" && t) live.current.patchTask(t.id, { status: "done" });
    else if (a.action === "snooze" && t)
      live.current.patchTask(t.id, { remind_at: new Date(Date.now() + 60 * 60_000).toISOString() });
    else if (t) {
      side(t.owner !== "joint" && t.list === "work" ? "work" : "personal");
      setSheet({ kind: "task", id: t.id });
    } else if (ev) {
      side(ev.work ? "work" : "personal");
      setViewState("calendar");
      setSheet({ kind: "event", id: ev.id });
    } else setViewState("today");
  }, []);

  useEffect(() => {
    if (phase.kind !== "app" || !isApp()) return;
    let off = () => {};
    void prepareNotifications().then((p) => {
      setNotifOff(p !== "granted");
      if (p !== "granted") return;
      // push: hearts, messages and joint to-dos reach this phone when the app is closed
      void registerPush(
        (token) => bs.api("/push/fcm", { method: "POST", body: { token } }),
        (url) => {
          const view = /[?&]view=(joint|wedding|calendar|mine|today|us)\b/.exec(url)?.[1] as View | undefined;
          if (view) setView(view);
        }
      );
    });
    void listen({
      onNotification,
      onLink: (path) => {
        setViewState("today");
        if (path === "add") setSheet({ kind: "new-task" });
      },
      onResume: () => void live.current.refresh(),
      onBack: () => {
        if (live.current.sheet) {
          setSheet(null);
          return true;
        }
        if (live.current.view !== "today") {
          setViewState("today");
          return true;
        }
        return false;
      },
    }).then((f) => (off = f));
    return () => off();
  }, [phase.kind, onNotification, setView]);

  useEffect(() => {
    if (phase.kind !== "app" || !isApp() || !me) return;
    const extras: Extra[] = [];
    const otherP = users.find((u) => u.id !== me.id);
    const bday = otherP ? bs.birthdays[otherP.id] : null;
    if (otherP && bday) {
      const n = nextYearly(bday);
      const twoWeeks = new Date(n.date.getFullYear(), n.date.getMonth(), n.date.getDate() - 14, 9, 0);
      extras.push({ key: `bday-14-${n.date.getFullYear()}`, title: `🎁 ${otherP.name}'s birthday is in 2 weeks`, body: "Have a look at your gift ideas in Us › Gifts.", at: twoWeeks });
      extras.push({ key: `bday-0-${n.date.getFullYear()}`, title: `🎂 It's ${otherP.name}'s birthday today!`, body: "Don't forget the card 😉", at: new Date(n.date.getFullYear(), n.date.getMonth(), n.date.getDate(), 8, 0) });
    }
    for (const c of bs.us.filter((x) => x.kind === "countdown" && x.day)) {
      const d = new Date(c.day + "T08:30:00");
      extras.push({ key: `cd-${c.id}`, title: `${c.emoji ?? "🎉"} Today: ${c.title}!`, body: "The countdown is over. Enjoy!", at: d });
    }
    const timer = setTimeout(() => void syncReminders(tasks, events, me.id, extras).catch(() => {}), 1200);
    return () => clearTimeout(timer);
  }, [phase.kind, tasks, events, me, users, bs.birthdays, bs.us]);

  // ——— always the latest version: reload when a new one goes live ———
  // (also inside the Android app, which loads this site live)
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!mine) return;
    let stop = false;
    const check = async () => {
      if (stop || !navigator.onLine) return;
      try {
        const r = await fetch("/api/backstage/version", { cache: "no-store" });
        const v = (await r.json()) as { build?: string };
        if (!v.build || v.build === mine) return;
        // nothing half-typed open: reload straight away (once per version,
        // so a stubborn cache can't cause a loop); otherwise offer it
        let tried = "";
        try {
          tried = sessionStorage.getItem("backstage:reloaded-for") ?? "";
          sessionStorage.setItem("backstage:reloaded-for", v.build);
        } catch {
          /* fine */
        }
        if (!live.current.sheet && tried !== v.build) window.location.reload();
        else setUpdateReady(true);
      } catch {
        /* try again later */
      }
    };
    void check();
    const timer = setInterval(check, 5 * 60_000);
    const onVis = () => !document.hidden && void check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  // ——— browsers: offer notifications once ———
  const [askPush, setAskPush] = useState(false);
  useEffect(() => {
    if (phase.kind !== "app" || !bs.pushKey) return;
    let dismissed = false;
    try {
      dismissed = !!localStorage.getItem("backstage:push-asked");
    } catch {
      /* fine */
    }
    if (dismissed) return;
    void pushState().then((s) => setAskPush(s === "off" && Notification.permission === "default"));
  }, [phase.kind, bs.pushKey]);
  const closeAskPush = () => {
    setAskPush(false);
    try {
      localStorage.setItem("backstage:push-asked", "1");
    } catch {
      /* fine */
    }
  };

  // ——— welcome, once per person per device ———
  useEffect(() => {
    if (phase.kind !== "app" || !me || space !== "personal") return;
    if (shouldWelcome(me)) setSheet((s) => s ?? { kind: "welcome" });
    else if (shouldShowNew()) setSheet((s) => s ?? { kind: "whatsnew" });
  }, [phase.kind, me, space]);

  // ——— chat: new messages and hearts, on every screen ———
  // The heartbeat (further down) fetches the chat the moment it changes, on
  // any screen. Whatever arrives is announced by the handler below: floating
  // hearts and a buzz for a heart, a buzz and a toast for a message.
  const [hearts, setHearts] = useState(0);
  const [notifOff, setNotifOff] = useState(false);
  const chatLive = useRef({ poll: bs.pollChat, say: bs.say });
  chatLive.current = { poll: bs.pollChat, say: bs.say };
  const onIncoming = bs.onIncoming;
  useEffect(() => {
    if (phase.kind !== "app" || !me) return;
    onIncoming((fresh: ChatMessage[]) => {
      // On the Work side nothing personal shows. Saying "not yet" keeps these
      // waiting, and they are announced the moment you switch to Personal.
      if (spaceRef.current === "work") return false;
      if (fresh.some((m) => m.kind === "heart")) {
        setHearts((h) => h + 1);
        buzz(BUZZ.heart);
      } else buzz(BUZZ.message);
      const last = fresh[fresh.length - 1];
      if (live.current.view !== "us" || live.current.usSection !== "chat") {
        chatLive.current.say(
          last.kind === "heart" ? `${nameOf(last.sender)} is thinking of you ❤️` : `💬 ${nameOf(last.sender)}: ${last.body.slice(0, 80)}`,
          "info",
          {
            label: "Open",
            run: () => {
              setUsSection("chat");
              setView("us");
            },
          }
        );
      }
      return true;
    });
    const tick = () => {
      if (document.hidden || !navigator.onLine) return;
      chatLive.current.poll(false).catch(() => {
        /* the next tick tries again */
      });
    };
    tick();
    const timer = setInterval(tick, 20_000); // a fallback: the heartbeat below asks as soon as the chat changes
    const onVis = () => !document.hidden && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      onIncoming(null);
    };
  }, [phase.kind, me, onIncoming, setView]);

  // back on Personal: whatever waited while Work was showing comes through now
  const firstSpace = useRef(true);
  useEffect(() => {
    if (phase.kind !== "app" || !me || space !== "personal") return;
    if (firstSpace.current) {
      firstSpace.current = false;
      return; // the checks that start with the app cover the first look
    }
    chatLive.current.poll(true).catch(() => {});
    quickCheck.current();
  }, [space, phase.kind, me]);
  useEffect(() => {
    if (space === "work") firstSpace.current = false;
  }, [space]);

  // ——— the other person's "how was your day": a card pops up when it changes ———
  const [moodAlert, setMoodAlert] = useState<{ emoji: string; n: number } | null>(null);
  // a one-time video: one waiting for me, and what happened to the last one I sent
  const [videoIn, setVideoIn] = useState<VideoIn | null>(null);
  const [videoOut, setVideoOut] = useState<VideoOut | null>(null);
  const [videoPrompt, setVideoPrompt] = useState<string | null>(null); // id to offer straight away
  const [videoPlaying, setVideoPlaying] = useState(false);
  // swipe games (dinner, dates): what you both said yes to, shown to each of you once
  const [matches, setMatches] = useState<GameMatch[]>([]);
  const matchShown = useRef(new Set<string>());
  const quickCheck = useRef<() => void>(() => {});
  const playingRef = useRef(false);
  playingRef.current = videoPlaying;
  useEffect(() => {
    if (phase.kind !== "app" || !me) return;
    const otherId = users.find((u) => u.id !== me.id)?.id;
    if (!otherId) return;
    let stop = false;
    let seen: string | null | undefined; // undefined = not looked yet (don't alert on opening)
    const check = async () => {
      if (document.hidden || !navigator.onLine) return;
      try {
        const r = await fetch("/api/backstage/us/moods", { cache: "no-store" });
        if (!r.ok) return;
        const { moods, video_in, video_out, dinner: dm, date: dt } = (await r.json()) as {
          dinner?: Omit<GameMatch, "game"> | null;
          date?: Omit<GameMatch, "game"> | null;
          moods: Array<{ added_by: string; emoji: string; updated_at: string }>;
          video_in?: VideoIn | null;
          video_out?: VideoOut | null;
        };
        if (stop) return;
        const personal = spaceRef.current === "personal"; // on the Work side these wait, unannounced
        if (!playingRef.current) {
          setVideoIn((cur) => {
            if (video_in && video_in.id !== cur?.id) {
              setVideoPrompt(video_in.id);
              if (personal) buzz(BUZZ.heart);
            }
            return video_in ?? null;
          });
        }
        setVideoOut(video_out ?? null);
        for (const m of [dm && { ...dm, game: "dinner" as const }, dt && { ...dt, game: "date" as const }]) {
          if (!m || !personal) continue;
          // a new match (also one made while this was closed): show it once
          const id = `${m.game}|${m.key}|${m.at}`;
          const store = `backstage:${m.game}-match:${me.id}`;
          let had: string | null = null;
          try {
            had = localStorage.getItem(store);
          } catch {
            /* private mode: the set below still stops repeats */
          }
          if (had === id || had === `${m.key}|${m.at}` || matchShown.current.has(id)) continue;
          matchShown.current.add(id);
          try {
            localStorage.setItem(store, id);
          } catch {
            /* fine */
          }
          setMatches((q) => [...q, m]);
          buzz(BUZZ.heart);
          void live.current.refresh();
        }
        const theirs = moods.find((m) => m.added_by === otherId);
        const key = theirs ? `${theirs.emoji}|${theirs.updated_at}` : null;
        if (stop) return;
        if (!personal) return; // their mood is looked at again once you are on Personal
        if (seen !== undefined && key && key !== seen) {
          setMoodAlert((a) => ({ emoji: theirs!.emoji, n: (a?.n ?? 0) + 1 }));
          buzz(BUZZ.mood);
          void live.current.refresh();
        }
        seen = key;
      } catch {
        /* try again on the next check */
      }
    };
    quickCheck.current = () => void check();
    void check();
    const timer = setInterval(check, 45_000); // a fallback: the heartbeat asks as soon as something changes
    const onVis = () => !document.hidden && void check();
    const onAsk = () => void check(); // e.g. right after a yes in the dinner game
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("backstage:check", onAsk);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("backstage:check", onAsk);
    };
  }, [phase.kind, me, users]);

  // ——— live updates: what the other person changes shows here within seconds ———
  // A heartbeat every 3 seconds asks the server for a fingerprint of everything
  // (see /api/backstage/pulse). When it changes, just that part is fetched:
  // tasks, projects, calendar and lists; the chat; or the fun checks. It waits
  // while you are dragging a card or a save of yours is on its way.
  const pulseLive = useRef({ isSaving: bs.isSaving, say: bs.say });
  pulseLive.current = { isSaving: bs.isSaving, say: bs.say };
  useEffect(() => {
    if (phase.kind !== "app" || !me) return;
    const otherName = users.find((u) => u.id !== me.id)?.name ?? "The other person";
    type Pulse = { v: string; u: string; c: string; x: string };
    let last: Pulse | null = null;
    let stop = false;
    let busy = false;
    const short = (t: { title: string }) => `“${t.title.length > 42 ? `${t.title.slice(0, 40)}…` : t.title}”`;
    // say what changed on the joint list (changes you made yourself are already on screen)
    const news = (before: typeof tasks, after: typeof tasks) => {
      if (spaceRef.current === "work") return; // joint and wedding changes are personal
      const was = new Map(before.filter((t) => t.owner === "joint").map((t) => [t.id, t]));
      const now = after.filter((t) => t.owner === "joint");
      const lines: string[] = [];
      for (const t of now) {
        const old = was.get(t.id);
        const by = t.updated_by ?? t.added_by;
        if (by === me.id) continue; // you, on another device
        const who = nameOf(by);
        if (!old) lines.push(`${who} added ${short(t)}`);
        else if (old.status !== t.status)
          lines.push(t.status === "done" ? `✓ ${who} ticked off ${short(t)}` : `${who} moved ${short(t)} to ${t.status === "doing" ? "In progress" : "To do"}`);
        else if (old.assignee !== t.assignee && t.assignee === me.id) lines.push(`${who} gave you ${short(t)}`);
        else if (old.title !== t.title || old.due_date !== t.due_date || old.priority !== t.priority || (old.notes ?? "") !== (t.notes ?? ""))
          lines.push(`${who} changed ${short(t)}`);
      }
      const still = new Set(after.map((t) => t.id));
      for (const [id, old] of was) if (!still.has(id)) lines.push(`${otherName} removed ${short(old)}`);
      if (!lines.length) return;
      const changed = now.filter((t) => { const o = was.get(t.id); return !o || o.status !== t.status || o.title !== t.title || o.assignee !== t.assignee; });
      const target: View = changed.length > 0 && changed.every((t) => t.wedding) ? "wedding" : "joint";
      pulseLive.current.say(
        lines.length === 1 ? lines[0] : `${lines.length} changes to the ${target === "wedding" ? "wedding" : "joint"} list: ${lines[0]}, and more`,
        "info",
        live.current.view === target ? undefined : { label: "Open", run: () => setView(target) }
      );
    };
    const beat = async () => {
      if (busy || document.hidden || !navigator.onLine) return;
      busy = true;
      try {
        const r = await fetch("/api/backstage/pulse", { cache: "no-store" });
        if (!r.ok || stop) return;
        const p = (await r.json()) as Pulse;
        const prev = last;
        if (prev && (p.v !== prev.v || p.u !== prev.u)) {
          // not while a card is in the air or a save is on its way: ask again on the next beat
          if (dragState.on || pulseLive.current.isSaving()) return;
          const before = live.current.tasks;
          const after = await live.current.refresh();
          if (stop) return;
          if (!after) return;
          if (p.v !== prev.v) news(before, after);
        }
        if (prev && p.c !== prev.c) chatLive.current.poll(false).catch(() => {});
        if (prev && (p.u !== prev.u || p.x !== prev.x)) quickCheck.current();
        last = p;
      } catch {
        /* the next beat tries again */
      } finally {
        busy = false;
      }
    };
    void beat();
    const timer = setInterval(beat, 3000);
    const onVis = () => !document.hidden && void beat();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase.kind, me, users, setView]);

  // a full refresh now and then as well, in case a heartbeat was missed
  useEffect(() => {
    if (phase.kind !== "app") return;
    const timer = setInterval(() => {
      if (!document.hidden && navigator.onLine && !live.current.sheet && !dragState.on && !pulseLive.current.isSaving()) void live.current.refresh();
    }, 60_000);
    const onVis = () => !document.hidden && void live.current.refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase.kind]);

  // ——— what each view shows ———
  // Work: your own work tasks, work projects and work calendar entries, and
  // nothing else. Personal: your personal tasks plus everything joint.
  const spaceTasks = useMemo(
    () => tasks.filter((t) => (space === "work" ? t.owner === me?.id && t.list === "work" : t.owner === "joint" || t.list === "personal")),
    [tasks, space, me]
  );
  // (an entry the other person shared with you is a personal thing, whatever they filed it under)
  const spaceEvents = useMemo(
    () => events.filter((e) => (e.owner !== me?.id && e.owner !== "joint" ? space === "personal" : space === "work" ? e.work : !e.work)),
    [events, space, me]
  );
  const mineInList = useMemo(
    () => tasks.filter((t) => me && t.owner === me.id && t.list === list),
    [tasks, me, list]
  );
  const mineShown = useMemo(
    () => (project ? mineInList.filter((t) => t.project_id === project) : mineInList),
    [mineInList, project]
  );
  // Wedding planning is its own joint section; the everyday joint list is everything else.
  const wedding = useMemo(() => tasks.filter((t) => t.wedding), [tasks]);
  const weddingOpen = wedding.filter((t) => t.status !== "done").length;
  const joint = useMemo(() => tasks.filter((t) => t.owner === "joint" && !t.wedding), [tasks]);
  const jointShown = useMemo(
    () =>
      joint.filter((t) =>
        jointFor === "all"
          ? true
          : jointFor === "me"
            ? !t.assignee || t.assignee === "both" || t.assignee === me?.id
            : !t.assignee || t.assignee === "both" || (t.assignee !== me?.id)
      ),
    [joint, jointFor, me]
  );
  const myProjects = projects.filter((p) => p.owner === me?.id || p.owner === "joint");
  const spaceProjects = myProjects.filter((p) => p.list === space);
  // the filter row also keeps a project from the other side that still has open tasks here
  const chipProjects = [
    ...spaceProjects,
    ...myProjects.filter((p) => p.list !== space && mineInList.some((t) => t.project_id === p.id && t.status !== "done")),
  ];
  const openCount = (l: ListName) => tasks.filter((t) => t.owner === me?.id && t.list === l && t.status !== "done").length;
  const jointOpen = joint.filter((t) => t.status !== "done").length;
  const unread = bs.messages.filter((m) => !m.read_at).length;
  const dueTasks = due
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t && t.status !== "done" && (space === "personal" || (t.owner === me?.id && t.list === "work")));
  const other = users.find((u) => u.id !== me?.id);
  const champion = lastWeekChampion(bs.scores, users);

  if (phase.kind !== "app" || !me) return <Gate bs={bs} />;

  const personal = space === "personal";
  const openTask = sheet?.kind === "task" ? tasks.find((t) => t.id === sheet.id) : undefined;
  const openEvent = sheet?.kind === "event" && sheet.id ? events.find((e) => e.id === sheet.id) : undefined;

  // Whatever is typed into an "Add…" box is one task, however long it is.
  const addTyped = (text: string, owner: "mine" | "joint" | "wedding", areaId: string | null = null, forWho: Assignee | null = null) => {
    const d = parseTask(text, { projects: spaceProjects, others: personal ? users.filter((u) => u.id !== me.id) : [] });
    if (!d) return;
    void bs.addDrafts(
      [
        {
          ...d,
          kind: "task" as const,
          list: space, // what you add on a side stays on that side
          joint: personal && (owner !== "mine" || d.joint),
          wedding: owner === "wedding",
          area_id: owner === "wedding" ? areaId : null,
          // a wedding to-do is for whoever the Wedding section's picker says
          // (no one yet, one of you, or both), unless the text names someone
          assignee: owner === "wedding" ? d.assignee ?? forWho : owner === "joint" || d.joint ? d.assignee ?? "both" : null,
          project_id: d.project_id ?? (owner === "mine" ? project : null),
        },
      ],
      list
    );
  };

  // The + button says what it adds where you are, and adds that.
  const wedAreaNow = view === "wedding" && wedArea && wedArea !== "none" ? bs.wedding.areas.find((a) => a.id === wedArea) : undefined;
  const addWord =
    view === "calendar"
      ? "Event"
      : view === "wedding"
        ? wedTab === "guests"
          ? "Guest names"
          : wedTab === "calendar"
            ? "Appointment"
            : wedAreaNow
            ? `${wedAreaNow.name} to-do`
            : "Wedding to-do"
        : view === "joint"
          ? "Joint to-do"
          : view === "mine"
            ? personal
              ? "Personal task"
              : "Work task"
            : "Task";
  const addHere = () => {
    if (view === "wedding" && wedTab === "guests") {
      // the guest lists have their own box: go to it
      const box = document.querySelector<HTMLInputElement>(".bs-guestlist .add input");
      box?.scrollIntoView({ block: "center", behavior: "smooth" });
      box?.focus({ preventScroll: true });
      return;
    }
    if (view === "wedding" && wedTab === "calendar") {
      setSheet({ kind: "event", day: ymd(new Date()), preset: { title: "", time: "12:00", wedding: true } });
      return;
    }
    setSheet(view === "calendar" ? { kind: "event", day: ymd(new Date()) } : { kind: "new-task" });
  };

  const NAV: Array<{ id: View; label: string; n?: number; icon: React.ReactNode }> = personal
    ? [
        { id: "today", label: "Today", icon: <IconToday /> },
        { id: "mine", label: "My tasks", n: openCount("personal"), icon: <IconCheck /> },
        { id: "joint", label: "Joint", n: jointOpen, icon: <IconJoint /> },
        { id: "wedding", label: "Wedding", n: weddingOpen, icon: <IconRing /> },
        { id: "calendar", label: "Calendar", icon: <IconCal /> },
        { id: "us", label: "Us", n: bs.chatUnread, icon: <IconHeart /> },
      ]
    : [
        { id: "today", label: "Today", icon: <IconToday /> },
        { id: "mine", label: "Tasks", n: openCount("work"), icon: <IconCheck /> },
        { id: "calendar", label: "Calendar", icon: <IconCal /> },
      ];

  return (
    <div className="bs-app" data-view={view} data-space={space} data-me={me.id}>
      <header className="bs-head">
        <div className="bs-title">
          <h1>Backstage</h1>
          <div className="bs-space" role="group" aria-label="Work or Personal">
            {(["work", "personal"] as Space[]).map((sp) => (
              <button key={sp} data-space={sp} aria-pressed={space === sp} onClick={() => space !== sp && setSpace(sp)}>
                {sp === "work" ? <IconWork /> : <IconHome />}
                {sp === "work" ? "Work" : "Personal"}
              </button>
            ))}
          </div>
        </div>
        <nav className="bs-tabs" aria-label="Sections">
          {NAV.map((n) => (
            <button key={n.id} aria-current={view === n.id ? "page" : undefined} onClick={() => setView(n.id)}>
              {n.label}
              {!!n.n && <span className="n">{n.n}</span>}
            </button>
          ))}
        </nav>
        <div className="who">
          <button className="bs-add" onClick={addHere}>
            + {addWord}
          </button>
          {me.admin && personal && (
            <button className="bs-iconbtn bs-mail" aria-current={view === "messages" ? "page" : undefined} title="Messages from the website" aria-label={`Messages${unread ? `, ${unread} unread` : ""}`} onClick={() => setView("messages")}>
              <IconMail />
              {unread > 0 && <span className="badge">{unread}</span>}
            </button>
          )}
          {personal && (
            <button
              className="bs-iconbtn bs-love"
              aria-label={`Send ${other?.name ?? ""} a heart`}
              title={`Thinking of ${other?.name ?? "you"}`}
              onClick={() => {
                buzz(BUZZ.tap);
                void bs.sendChat("❤️", "heart").then((ok) => ok && bs.say(`❤️ sent to ${other?.name ?? ""}`));
                setHearts((h) => h + 1);
              }}
            >
              <IconHeart filled />
            </button>
          )}
          <button className="bs-avatar-btn" onClick={() => setSheet({ kind: "settings" })} aria-label={`${me.name}: settings and sign out`}>
            <span className="bs-avatar" style={{ background: me.color }}>
              {me.name[0]}
            </span>
            {personal && champion === me.id && (
              <span className="bs-crown" title="Last week's chore champion">
                👑
              </span>
            )}
          </button>
        </div>
      </header>

      {dueTasks.length > 0 && (
        <div className="bs-due" role="status">
          <strong>{dueTasks.length === 1 ? "Reminder" : `${dueTasks.length} reminders`}</strong>
          <ul>
            {dueTasks.map((t) => (
              <li key={t.id}>
                <button onClick={() => setSheet({ kind: "task", id: t.id })}>{t.title}</button>
              </li>
            ))}
          </ul>
          <button className="bs-x" onClick={() => setDue([])} aria-label="Dismiss reminders">
            ×
          </button>
        </div>
      )}

      {notifOff && (
        <div className="bs-due warn" role="status">
          <strong>Reminders are off</strong>
          <span>
            Android isn&rsquo;t letting Backstage show notifications, so reminders won&rsquo;t go off. Open Settings ›
            Apps › Backstage › Notifications and switch them on.
          </span>
          <button className="bs-x" onClick={() => setNotifOff(false)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {updateReady && (
        <div className="bs-due" role="status">
          <strong>New version ready</strong>
          <span>Backstage has been updated.</span>
          <button className="btn small" onClick={() => window.location.reload()}>
            Update now
          </button>
        </div>
      )}
      {askPush && !sheet && personal && (
        <div className="bs-due" role="status">
          <strong>🔔 Get notified</strong>
          <span>
            Know straight away when {other?.name ?? "the other person"} messages you, sends a heart or adds something
            joint, even with Backstage closed.
          </span>
          <button
            className="btn small"
            onClick={async () => {
              const err = await enablePush(bs.pushKey, bs.api);
              closeAskPush();
              bs.say(err || "Notifications are on 🎉", err ? "error" : "info");
            }}
          >
            Turn on
          </button>
          <button className="bs-x" onClick={closeAskPush} aria-label="Not now">
            ×
          </button>
        </div>
      )}

      <main className="bs-main">
        {view === "today" && (
          <Dashboard
            space={space}
            me={me}
            tasks={spaceTasks}
            events={spaceEvents}
            projects={spaceProjects}
            onOpen={(id) => setSheet({ kind: "task", id })}
            onOpenEvent={(id) => setSheet({ kind: "event", id })}
            onCalendar={() => setView("calendar")}
            onPatch={bs.patchTask}
            onDelete={bs.deleteTask}
            onPickProject={(id) => {
              setProject(id);
              setView("mine");
            }}
            onManageProjects={() => setSheet({ kind: "projects" })}
            top={
              personal && videoIn && other ? (
                <VideoWaiting
                  fromName={other.name}
                  video={videoIn}
                  onWatch={() => {
                    setVideoPrompt(null);
                    setVideoPlaying(true);
                  }}
                />
              ) : null
            }
            side={personal && me.admin && other ? <VideoSender toName={other.name} out={videoOut} onChanged={() => quickCheck.current()} say={bs.say} /> : null}
            bs={bs}
            users={users}
            onWedding={() => setView("wedding")}
            onUs={(sec) => {
              setUsSection(sec);
              setView("us");
            }}
          />
        )}

        {view === "mine" && (
          <>
            <div className="bs-bar">
              <h2 className="bs-viewtitle">
                {personal ? "My personal tasks" : "Work tasks"} <span className="n">{openCount(list)} open</span>
              </h2>
              <div className="bs-filter">
                <button aria-pressed={project === null} onClick={() => setProject(null)}>
                  All
                </button>
                {chipProjects.map((p) => {
                  const n = mineInList.filter((t) => t.project_id === p.id && t.status !== "done").length;
                  return (
                    <button key={p.id} aria-pressed={project === p.id} onClick={() => setProject(project === p.id ? null : p.id)}>
                      <span className="bs-dot" style={{ background: p.color }} />
                      {p.name}
                      {n > 0 && <span className="n">{n}</span>}
                    </button>
                  );
                })}
                <button className="edit" onClick={() => setSheet({ kind: "projects" })}>
                  {spaceProjects.length ? "Projects" : "+ Project"}
                </button>
              </div>
            </div>
            {narrow ? (
              <TaskList
                tasks={mineShown}
                projects={projects}
                me={me.id}
                onOpen={(id) => setSheet({ kind: "task", id })}
                onPatch={bs.patchTask}
                onDelete={bs.deleteTask}
                onAdd={(t) => addTyped(t, "mine")}
                placeholder={personal ? "Add a personal task…" : "Add a work task…"}
              />
            ) : (
              <Board
                key={list}
                addWhat={personal ? "a personal task" : "a work task"}
                tasks={mineShown}
                projects={projects}
                canEdit
                onAdd={(t) => addTyped(t, "mine")}
                onPatch={bs.patchTask}
                onDelete={bs.deleteTask}
                onOpen={(id) => setSheet({ kind: "task", id })}
              />
            )}
          </>
        )}

        {view === "joint" && (
          <>
            <div className="bs-bar">
              <p className="bs-joint-note">
                <span className="bs-pair" aria-hidden="true">
                  <i style={{ background: "#1a47ff" }} />
                  <i style={{ background: "#e0457b" }} />
                </span>
                Shared with {other?.name ?? "each other"}. Blue = added by Umit, pink = added by Dilfiraz.
              </p>
              <div className="bs-seg" role="tablist" aria-label="Joint">
                <button role="tab" aria-pressed={jointTab === "todos"} aria-selected={jointTab === "todos"} onClick={() => setJointTab("todos")}>
                  To-dos <span className="n">{jointOpen}</span>
                </button>
                <button role="tab" aria-pressed={jointTab === "shopping"} aria-selected={jointTab === "shopping"} onClick={() => setJointTab("shopping")}>
                  🛒 Shopping <span className="n">{bs.us.filter((x) => x.kind === "shopping" && !x.done).length}</span>
                </button>
              </div>
              {jointTab === "todos" && <div className="bs-seg small" role="group" aria-label="Show">
                <button aria-pressed={jointFor === "all"} onClick={() => setJointFor("all")}>
                  Everything
                </button>
                <button aria-pressed={jointFor === "me"} onClick={() => setJointFor("me")}>
                  For me
                </button>
                {other && (
                  <button aria-pressed={jointFor === "other"} onClick={() => setJointFor("other")}>
                    For {other.name}
                  </button>
                )}
              </div>}
            </div>
            {jointTab === "shopping" ? (
              <Shopping bs={bs} me={me} />
            ) : narrow ? (
              <TaskList
                tasks={jointShown}
                projects={projects}
                me={me.id}
                onOpen={(id) => setSheet({ kind: "task", id })}
                onPatch={bs.patchTask}
                onDelete={bs.deleteTask}
                onAdd={(t) => addTyped(t, "joint")}
                placeholder="Add a joint to-do…"
              />
            ) : (
              <Board
                key="joint"
                addWhat="a joint to-do"
                tasks={jointShown}
                projects={projects}
                canEdit
                onAdd={(t) => addTyped(t, "joint")}
                onPatch={bs.patchTask}
                onDelete={bs.deleteTask}
                onOpen={(id) => setSheet({ kind: "task", id })}
              />
            )}
          </>
        )}

        {view === "wedding" && (
          <WeddingView
            bs={bs}
            me={me}
            users={users}
            tasks={wedding}
            events={events.filter((e) => e.wedding)}
            projects={projects}
            narrow={narrow}
            area={wedArea}
            setArea={setWedArea}
            tab={wedTab}
            setTab={setWedTab}
            onOpen={(id) => setSheet({ kind: "task", id })}
            onOpenEvent={(id) => setSheet({ kind: "event", id })}
            onAdd={(t, areaId, forWho) => addTyped(t, "wedding", areaId, forWho)}
            onNewDate={(day) => setSheet({ kind: "event", day: day ?? ymd(new Date()), preset: { title: "", time: "12:00", wedding: true } })}
          />
        )}

        {view === "calendar" && (
          <Calendar
            space={space}
            me={me}
            users={users}
            events={spaceEvents}
            tasks={spaceTasks}
            projects={spaceProjects}
            onOpenEvent={(id) => setSheet({ kind: "event", id })}
            onOpenTask={(id) => setSheet({ kind: "task", id })}
            onNewEvent={(day) => setSheet({ kind: "event", day })}
          />
        )}

        {view === "us" && (
          <UsHub
            bs={bs}
            me={me}
            users={users}
            section={usSection}
            onSection={setUsSection}
            onPlan={(title, day, time) => setSheet({ kind: "event", day, preset: { title, time, joint: true } })}
          />
        )}

        {view === "messages" && me.admin && <Messages bs={bs} messages={bs.messages} />}
      </main>

      <nav className="bs-bottom" aria-label="Sections" style={{ ["--cols" as string]: NAV.length }}>
        {NAV.map((n) => (
          <button key={n.id} data-nav={n.id} aria-current={view === n.id ? "page" : undefined} onClick={() => setView(n.id)}>
            <span className="ico">
              {n.icon}
              {!!n.n && personal && (n.id === "joint" || n.id === "us") && <span className={`badge${n.id === "us" ? " us" : ""}`}>{n.n}</span>}
            </span>
            <span className="lbl">{n.label}</span>
          </button>
        ))}
      </nav>

      {!sheet && view !== "messages" && !(view === "us" && usSection === "chat") && (
        <div className="bs-fabs">
          <button
            className="bs-fab plus"
            onClick={addHere}
            aria-label={`Add: ${addWord}`}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      )}

      {openTask && (
        <TaskDrawer
          bs={bs}
          space={space}
          task={openTask}
          projects={myProjects}
          me={me}
          users={users}
          onPatch={bs.patchTask}
          onDelete={bs.deleteTask}
          onClose={() => setSheet(null)}
          say={bs.say}
          onNudge={bs.nudge}
        />
      )}
      {sheet?.kind === "event" && (!sheet.id || openEvent) && !openEvent?.busy && (
        <EventSheet
          key={sheet.id ?? sheet.day}
          space={space}
          bs={bs}
          me={me}
          users={users}
          event={openEvent}
          day={sheet.day}
          preset={sheet.preset}
          onClose={() => setSheet(null)}
          onSwitchToTask={sheet.id ? undefined : () => setSheet({ kind: "new-task" })}
        />
      )}
      {sheet?.kind === "new-task" && (
        <NewTask
          bs={bs}
          me={me}
          users={users}
          space={space}
          projects={myProjects}
          defaultProject={view === "mine" ? project : null}
          defaultOwner={personal && (view === "joint" || view === "wedding") ? "joint" : me.id}
          defaultWedding={view === "wedding"}
          defaultArea={view === "wedding" && wedArea !== "none" ? wedArea : null}
          onClose={() => setSheet(null)}
          onSwitchToEvent={() => setSheet({ kind: "event", day: ymd(new Date()) })}
        />
      )}
      {sheet?.kind === "projects" && <Projects bs={bs} space={space} projects={myProjects} onClose={() => setSheet(null)} />}
      {sheet?.kind === "settings" && (
        <Settings bs={bs} me={me} space={space} onClose={() => setSheet(null)} onHelp={() => setSheet({ kind: "help" })} />
      )}
      {sheet?.kind === "help" && <Help onClose={() => setSheet(null)} onReplayWelcome={() => setSheet({ kind: "welcome" })} />}
      {sheet?.kind === "welcome" && <Welcome me={me} users={users} onClose={() => setSheet(null)} />}
      {sheet?.kind === "whatsnew" && <WhatsNew onClose={() => setSheet(null)} />}
      {!bs.online && (
        <div className="bs-offline" role="alert">
          <strong>You&rsquo;re offline.</strong> You can look around, but changes won&rsquo;t save until you&rsquo;re back online.
        </div>
      )}
      {personal && videoIn && other && (
        <VideoGift
          key={videoIn.id}
          fromName={other.name}
          video={videoIn}
          autoPrompt={videoPrompt === videoIn.id && !sheet}
          playing={videoPlaying}
          onPlay={() => {
            setVideoPrompt(null);
            setVideoPlaying(true);
          }}
          onLater={() => {
            setVideoPrompt(null);
            setVideoPlaying(false);
          }}
          onDone={() => {
            setVideoPlaying(false);
            setVideoPrompt(null);
            setVideoIn(null);
          }}
          onHeart={() => {
            void bs.sendChat("❤️", "heart");
            setHearts((h) => h + 1);
          }}
        />
      )}
      {personal && hearts > 0 && <Hearts key={hearts} />}
      {personal && moodAlert && other && (
        <MoodAlert
          key={moodAlert.n}
          name={other.name}
          emoji={moodAlert.emoji}
          onClose={() => setMoodAlert(null)}
          onHeart={() => {
            buzz(BUZZ.tap);
            void bs.sendChat("❤️", "heart").then((ok) => ok && bs.say(`❤️ sent to ${other.name}`));
            setHearts((h) => h + 1);
            setMoodAlert(null);
          }}
          onSee={() => {
            setView("today");
            setMoodAlert(null);
          }}
        />
      )}
      {personal && matches[0] && other && (
        <MatchAlert
          key={`${matches[0].game}|${matches[0].key}|${matches[0].at}`}
          match={matches[0]}
          otherName={other.name}
          onClose={() => setMatches((q) => q.slice(1))}
          onPlan={() => {
            const m = matches[0];
            setMatches((q) => q.slice(1));
            setSheet(
              m.game === "dinner"
                ? { kind: "event", day: ymd(new Date()), preset: { title: `Dinner: ${m.title}`, time: "19:30", joint: true } }
                : { kind: "event", day: nextSaturday(), preset: { title: `Date night: ${m.title}`, time: "19:00", joint: true } }
            );
          }}
        />
      )}
      {bs.notice && (
        <div className={`bs-toast${bs.notice.tone === "error" ? " error" : ""}`} role={bs.notice.tone === "error" ? "alert" : "status"}>
          <span>{bs.notice.text}</span>
          {bs.notice.action && (
            <button
              onClick={() => {
                bs.notice?.action?.run();
              }}
            >
              {bs.notice.action.label}
            </button>
          )}
        </div>
      )}
      <span hidden>{nameOf(me.id)}</span>
    </div>
  );
}

// ——— icons (24px, stroke) ———
const S = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function IconToday() {
  return (
    <svg {...S}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...S}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 12.5l2.8 2.8L16.5 9" />
    </svg>
  );
}
function IconRing() {
  return (
    <svg {...S}>
      <circle cx="12" cy="15" r="5.6" />
      <path d="M9.6 6.2 12 3.6l2.4 2.6L12 9.4z" />
    </svg>
  );
}
function IconJoint() {
  return (
    <svg {...S}>
      <circle cx="9" cy="8.5" r="3.2" />
      <circle cx="16.5" cy="9.5" r="2.6" />
      <path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5M14.6 14.6c2.6-.4 5 .9 5.9 4.4" />
    </svg>
  );
}
function IconCal() {
  return (
    <svg {...S}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}
function IconHeart({ filled = false }: { filled?: boolean }) {
  return (
    <svg {...S} {...(filled ? { fill: "currentColor" } : {})}>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
    </svg>
  );
}
/** "Dilfiraz is feeling 🤗": drops in from the top when their mood changes. */
function MoodAlert({ name, emoji, onClose, onHeart, onSee }: { name: string; emoji: string; onClose: () => void; onHeart: () => void; onSee: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => close.current(), 12_000);
    return () => clearTimeout(t);
  }, []);
  const label = MOODS.find(([m]) => m === emoji)?.[1] ?? "";
  return (
    <div className="bs-moodalert" role="alert">
      <span className="e" aria-hidden="true">
        {emoji}
      </span>
      <div className="txt">
        <strong>
          {name} is feeling {label.toLowerCase()}
        </strong>
        <span>{emoji === "🤗" ? "They could do with a hug." : "Their day just changed."}</span>
      </div>
      <div className="acts">
        <button className="heart" onClick={onHeart} aria-label={`Send ${name} a heart`}>
          ❤️
        </button>
        <button className="bs-link" onClick={onSee}>
          See
        </button>
        <button className="bs-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}

/** Hearts floating up the screen (a heart arrived). */
function Hearts() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 4200);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div className="bs-hearts" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <span key={i} style={{ left: `${((i * 37) % 92) + 2}%`, animationDelay: `${(i % 8) * 0.17}s`, fontSize: `${38 + ((i * 13) % 42)}px` }}>
          ❤️
        </span>
      ))}
    </div>
  );
}
function IconWork() {
  return (
    <svg {...S} width={18} height={18}>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 13h18" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg {...S} width={18} height={18}>
      <path d="M4 11.2 12 4.5l8 6.7V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg {...S}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3.5 7l8.5 6.5L20.5 7" />
    </svg>
  );
}
