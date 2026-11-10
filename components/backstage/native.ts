"use client";

// The Android app's extras, used only when Backstage runs inside the app
// (mobile/, built with Capacitor). In a normal browser every function here
// quietly does nothing, so the website behaves exactly as before.
//
// - reminders are scheduled on the phone, so they go off with the app closed
// - each reminder has Done and Snooze 1h buttons
// - an 8am summary for each of the next 7 days
// - "Speak a task" shortcut and backstage:// links
import { Capacitor } from "@capacitor/core";
import type { Task } from "./types";

export const isApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

const plugins = () =>
  Promise.all([
    import("@capacitor/local-notifications").then((m) => m.LocalNotifications),
    import("@capacitor/app").then((m) => m.App),
  ]);

// Notification ids are 31-bit numbers; a task's id is hashed into one.
function idFor(taskId: string): number {
  let h = 2166136261;
  for (let i = 0; i < taskId.length; i++) h = Math.imul(h ^ taskId.charCodeAt(i), 16777619);
  return (h >>> 1) % 800_000_000 + 1_000;
}
const DIGEST_BASE = 900_000_000; // + day offset 0..6

export type NotificationAction = { action: "open" | "done" | "snooze"; taskId: string | null };

const DIGEST_HOUR = 8;
const MAX_SCHEDULED = 200; // Android keeps at most 500 alarms per app

/** Ask once for notification permission and set up the buttons. */
export async function prepareNotifications(): Promise<"granted" | "denied"> {
  if (!isApp()) return "denied";
  const [LN] = await plugins();
  let perm = await LN.checkPermissions();
  if (perm.display !== "granted") perm = await LN.requestPermissions();
  await LN.registerActionTypes({
    types: [
      {
        id: "TASK",
        actions: [
          { id: "done", title: "Done" },
          { id: "snooze", title: "Snooze 1h" },
        ],
      },
    ],
  });
  await LN.createChannel({
    id: "reminders",
    name: "Reminders",
    description: "Task reminders from Backstage",
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch(() => {});
  await LN.createChannel({
    id: "digest",
    name: "Morning summary",
    description: "What's due today, at 8am",
    importance: 3,
    visibility: 1,
  }).catch(() => {});
  return perm.display === "granted" ? "granted" : "denied";
}

/** Whether Android lets reminders fire on the minute (Android 12+ setting). */
export async function exactAlarms(): Promise<"granted" | "denied" | "n/a"> {
  if (!isApp()) return "n/a";
  const [LN] = await plugins();
  try {
    const r = await LN.checkExactNotificationSetting();
    return r.exact_alarm === "granted" ? "granted" : "denied";
  } catch {
    return "n/a";
  }
}
export async function openExactAlarmSetting() {
  if (!isApp()) return;
  const [LN] = await plugins();
  await LN.changeExactNotificationSetting().catch(() => {});
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Replace everything scheduled on the phone with the current reminders. */
export async function syncReminders(tasks: Task[]): Promise<number> {
  if (!isApp()) return 0;
  const [LN] = await plugins();
  const pending = await LN.getPending();
  if (pending.notifications.length) {
    await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  const now = Date.now();
  const open = tasks.filter((t) => t.status !== "done");

  const reminders = open
    .filter((t) => t.remind_at && new Date(t.remind_at).getTime() > now + 5_000)
    .sort((a, b) => new Date(a.remind_at!).getTime() - new Date(b.remind_at!).getTime())
    .slice(0, MAX_SCHEDULED)
    .map((t) => ({
      id: idFor(t.id),
      title: t.title,
      body: t.due_date ? `Due ${new Date(t.due_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : "Backstage reminder",
      schedule: { at: new Date(t.remind_at!), allowWhileIdle: true },
      actionTypeId: "TASK",
      channelId: "reminders",
      extra: { taskId: t.id },
      smallIcon: "ic_stat_backstage",
      iconColor: "#1a47ff",
    }));

  // An 8am summary for today (if it's still before 8) and the next six days.
  const digests = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, DIGEST_HOUR, 0);
    if (at.getTime() <= now) continue;
    const day = ymd(at);
    const due = open.filter((t) => t.due_date === day).length;
    const late = open.filter((t) => t.due_date && t.due_date < day).length;
    if (!due && !late) continue;
    const parts = [];
    if (due) parts.push(`${due} due today`);
    if (late) parts.push(`${late} overdue`);
    const first = open
      .filter((t) => t.due_date === day)
      .sort((a, b) => (a.priority === "high" ? -1 : 0) - (b.priority === "high" ? -1 : 0))
      .slice(0, 3)
      .map((t) => t.title);
    digests.push({
      id: DIGEST_BASE + i,
      title: parts.join(", "),
      body: first.length ? first.join(" · ") : "Open Backstage to catch up.",
      schedule: { at, allowWhileIdle: true },
      channelId: "digest",
      extra: { taskId: null, digest: true },
      smallIcon: "ic_stat_backstage",
      iconColor: "#1a47ff",
    });
  }

  const all = [...reminders, ...digests];
  if (all.length) await LN.schedule({ notifications: all });
  return reminders.length;
}

/**
 * Listen for the app's own events: notification taps and buttons, the
 * home-screen shortcut, and the app coming back to the front.
 */
export async function listen(handlers: {
  onNotification: (a: NotificationAction) => void;
  onLink: (path: "capture" | "today" | "other") => void;
  onResume: () => void;
}): Promise<() => void> {
  if (!isApp()) return () => {};
  const [LN, App] = await plugins();
  const linkPath = (url: string) =>
    /capture|speak/i.test(url) ? "capture" : /today/i.test(url) ? "today" : "other";

  const subs = await Promise.all([
    LN.addListener("localNotificationActionPerformed", (e) => {
      const taskId = (e.notification.extra?.taskId as string | null) ?? null;
      const action = e.actionId === "done" ? "done" : e.actionId === "snooze" ? "snooze" : "open";
      handlers.onNotification({ action, taskId });
    }),
    App.addListener("appUrlOpen", (e) => handlers.onLink(linkPath(e.url))),
    App.addListener("resume", () => handlers.onResume()),
  ]);
  // opened from the shortcut while the app was closed
  const launch = await App.getLaunchUrl().catch(() => undefined);
  if (launch?.url) handlers.onLink(linkPath(launch.url));
  return () => subs.forEach((s) => void s.remove());
}

// ——— speech ———

type WebRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export type SpeechSupport = "app" | "browser" | "none";

export function speechSupport(): SpeechSupport {
  if (typeof window === "undefined") return "none";
  if (isApp()) return "app";
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return w.SpeechRecognition || w.webkitSpeechRecognition ? "browser" : "none";
}

/**
 * Start listening. `onText` gets the words heard so far (replacing the
 * previous call's text); `onEnd` fires once when listening stops, with an
 * error message if something went wrong. Returns a stop function.
 */
export async function listenForSpeech(opts: {
  lang: string;
  onText: (text: string) => void;
  onEnd: (error?: string) => void;
}): Promise<() => void> {
  const support = speechSupport();
  if (support === "app") {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const ok = await SpeechRecognition.available().catch(() => ({ available: false }));
    if (!ok.available) {
      opts.onEnd("This phone has no speech recogniser. Install or update the Google app.");
      return () => {};
    }
    let perm = await SpeechRecognition.checkPermissions();
    if (perm.speechRecognition !== "granted") perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== "granted") {
      opts.onEnd("Backstage needs the microphone. Allow it in Android Settings › Apps › Backstage.");
      return () => {};
    }
    let ended = false;
    const finish = (err?: string) => {
      if (ended) return;
      ended = true;
      void SpeechRecognition.removeAllListeners();
      opts.onEnd(err);
    };
    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.addListener("partialResults", (d) => {
      if (d.matches?.[0]) opts.onText(d.matches[0]);
    });
    await SpeechRecognition.addListener("listeningState", (d) => {
      if (d.status === "stopped") finish();
    });
    SpeechRecognition.start({ language: opts.lang, partialResults: true, popup: false, maxResults: 1 }).catch(
      (e: Error) => finish(/no match|didn't|not understand/i.test(e.message) ? undefined : e.message)
    );
    return () => {
      void SpeechRecognition.stop().catch(() => {});
      setTimeout(() => finish(), 800);
    };
  }

  if (support === "browser") {
    const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
    const Rec = (w.SpeechRecognition ?? w.webkitSpeechRecognition)!;
    const rec = new Rec();
    rec.lang = opts.lang;
    rec.continuous = true;
    rec.interimResults = true;
    let finals = "";
    let failed: string | undefined;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += (finals ? " " : "") + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      opts.onText((finals + " " + interim).trim());
    };
    rec.onerror = (e) => {
      failed =
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "The browser blocked the microphone. Allow it for this site and try again."
          : e.error === "no-speech" || e.error === "aborted"
            ? undefined
            : `Speech stopped (${e.error}).`;
    };
    rec.onend = () => opts.onEnd(failed);
    rec.start();
    return () => rec.stop();
  }

  opts.onEnd("This browser can't listen. Type instead, or use Chrome or the Android app.");
  return () => {};
}
