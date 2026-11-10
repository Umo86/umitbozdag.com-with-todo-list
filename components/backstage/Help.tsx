"use client";

// How Backstage works: a short welcome the first time each person signs in
// on a device, and a help sheet (You › How Backstage works) with tips and
// fixes for the usual problems.
import { useEffect, useState } from "react";
import { MicIcon } from "./Dashboard";
import { isApp } from "./native";
import type { Me, Person } from "./types";

const WELCOME_KEY = (id: string) => `backstage:welcomed:${id}`;

export function shouldWelcome(me: Me): boolean {
  try {
    return !localStorage.getItem(WELCOME_KEY(me.id));
  } catch {
    return false;
  }
}

export function Welcome({ me, users, onClose }: { me: Me; users: Person[]; onClose: () => void }) {
  const other = users.find((u) => u.id !== me.id);
  const [i, setI] = useState(0);
  const cards = [
    {
      icon: "👋",
      title: `Welcome, ${me.name}`,
      body: `This is your and ${other?.name ?? "your partner"}'s planner. Your own to-dos stay private; anything marked Joint you both see. Things you add show in ${me.id === "umit" ? "blue" : "pink"}, ${other?.name ?? "theirs"}'s in ${me.id === "umit" ? "pink" : "blue"}.`,
    },
    {
      icon: <MicIcon size={30} />,
      title: "Just say it",
      body: "Tap the blue mic and talk: “call the venue tomorrow at 10, dinner Saturday at 7 joint, Dilfiraz to book the vet”. Check what it understood, then add it all. The + button is for typing one thing in properly.",
    },
    {
      icon: "📅",
      title: "One calendar for both",
      body: "Events, deadlines and due to-dos in one place. Your private events show to the other person only as “Busy”. Add the calendar to Google Calendar from You (your initial, top right).",
    },
    {
      icon: "⏰",
      title: "Reminders",
      body: isApp()
        ? "Reminders go off on this phone even when the app is closed, with Done and Snooze buttons, plus an 8am summary. Allow notifications when Android asks."
        : "In a browser, reminders pop up while Backstage is open. Install the Android app (umitbozdag.com/app) to get them with it closed.",
    },
  ];
  const c = cards[i];
  const finish = () => {
    try {
      localStorage.setItem(WELCOME_KEY(me.id), "1");
    } catch {
      /* fine */
    }
    onClose();
  };
  return (
    <div className="bs-scrim center">
      <div className="bs-welcome" role="dialog" aria-modal="true" aria-labelledby="wl-h">
        <div className="icon" aria-hidden="true">
          {c.icon}
        </div>
        <h2 id="wl-h">{c.title}</h2>
        <p>{c.body}</p>
        <div className="dots" aria-hidden="true">
          {cards.map((_, k) => (
            <i key={k} className={k === i ? "on" : undefined} />
          ))}
        </div>
        <div className="bs-drawer-foot">
          <button className="bs-link" onClick={finish}>
            Skip
          </button>
          <button className="btn" onClick={() => (i < cards.length - 1 ? setI(i + 1) : finish())} autoFocus>
            {i < cards.length - 1 ? "Next" : "Get started"}
          </button>
        </div>
      </div>
    </div>
  );
}

const TOPICS: Array<{ q: string; a: string[] }> = [
  {
    q: "Adding things by voice",
    a: [
      "Tap the blue mic and speak normally. You can say several things in one go.",
      "Times and days: “tomorrow at 10”, “Friday”, “next Monday”, “on 5th December”, “in 2 hours”.",
      "Reminders: “remind me Thursday at 6pm”. Repeats: “every Monday”, “every month”.",
      "Joint and who it's for: “joint”, “together”, “for both of us”, “Dilfiraz to book the vet”.",
      "Events vs to-dos: meetings, dinners, appointments and flights with a time become calendar events; everything else becomes a to-do. You can switch each one before adding.",
      "Projects: say the project's name (“for UKCW”). Priority: “urgent” or “no rush”.",
    ],
  },
  {
    q: "Mine, joint and the colours",
    a: [
      "My tasks: your own Work and Personal lists. Only you see them.",
      "Joint: the shared list. Either of you can add, edit and tick things off. A joint item can be for one of you or both.",
      "Blue = added by Umit, pink = added by Dilfiraz (the coloured edge on each card).",
      "Projects can be yours or joint (Projects › Whose).",
    ],
  },
  {
    q: "The calendar",
    a: [
      "Tap a day to see its plan; double-click (or + Event) to add an event.",
      "Your private events appear to the other person only as a grey “Busy” block.",
      "Repeating events: changes and deletes apply to every repeat.",
      "To see Backstage in Google or Samsung Calendar: You › Copy link / Add to Google Calendar. Keep that link private.",
    ],
  },
  {
    q: "The fun stuff (Us tab and Today)",
    a: [
      "❤️ in the top bar: sends a heart. Floating hearts pop up for the other person.",
      "Mood: pick how you feel on the Today screen; the other person sees it (🤗 = needs a hug).",
      "Countdowns: add a date (holiday, anniversary) and watch the days drop. Confetti on the day.",
      "Chore battle: ticking off a joint to-do scores a point (urgent = 2). Last week's winner wears the 👑.",
      "Nudge: open a joint to-do and tap 👉 Nudge. It lands in the chat (with a count, if it's become a habit…).",
      "Love notes: on a joint to-do you added, write a hidden note. It shows as 💌 for the other person and opens when they tap it.",
      "Us › Dinner: both swipe yes/no on dinner ideas. The first one you both like is a match.",
      "Us › Dates: spin the roulette on your date ideas and book the winner for Saturday.",
      "Us › Memories: keep little moments; one pops up on Today now and then.",
      "Us › Gifts: a private list of gift ideas for the other person (they never see it), with a reminder two weeks before their birthday. Add your own birthday there too.",
      "Joint › Shopping: a live shopping list. Type “milk, bread and eggs” to add three at once.",
    ],
  },
  {
    q: "Reminders and notifications",
    a: [
      "In the Android app, reminders are set on the phone and go off even when it's closed. Done ticks it off; Snooze moves it an hour.",
      "Added something on the computer? It reaches the phone next time you open the app.",
      "Chat messages only alert you while the app is open.",
    ],
  },
  {
    q: "Something isn't working",
    a: [
      "“Can't reach Backstage” or “No connection”: check Wi-Fi or mobile data, then try again. Nothing is lost; unsaved changes just need to be redone.",
      "Signed out unexpectedly: sessions last 30 days, and changing a password signs that person out everywhere. Sign in again.",
      "The mic doesn't start: Android Settings › Apps › Backstage › Permissions › Microphone › Allow. Speech uses the Google app, so keep it installed and up to date.",
      "No reminders on the phone: Settings › Apps › Backstage › Notifications on; also allow “Alarms & reminders”. Samsung/Xiaomi: Battery › Unrestricted.",
      "“Too many wrong passwords”: wait 15 minutes. Forgotten a password? Umit can set a new one.",
      "The app won't install over the old one: uninstall the old app first (your data is online, not on the phone).",
    ],
  },
];

export function Help({ onClose, onReplayWelcome }: { onClose: () => void; onReplayWelcome: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bs-drawer bs-sheet" role="dialog" aria-modal="true" aria-labelledby="help-h">
        <div className="bs-grab" aria-hidden="true" />
        <div className="bs-drawer-head">
          <h2 id="help-h">How Backstage works</h2>
          <button className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="bs-help">
          {TOPICS.map((t, k) => (
            <details key={t.q} open={k === 0}>
              <summary>{t.q}</summary>
              <ul>
                {t.a.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <div className="bs-drawer-foot">
          <button className="bs-link" onClick={onReplayWelcome}>
            Show the welcome again
          </button>
          <a className="bs-link" href="/app" target="_blank" rel="noreferrer">
            Get the Android app
          </a>
        </div>
      </div>
    </div>
  );
}
