"use client";

// How Backstage works: a short welcome the first time each person signs in
// on a device, and a help sheet (You › How Backstage works) with tips and
// fixes for the usual problems.
import { useEffect, useState } from "react";
import { isApp } from "./native";
import changelog from "@/lib/changelog.json";
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
      icon: "➕",
      title: "Add things with +",
      body: "Tap + to add a to-do or an event. Give it a name, pick Mine or Joint, and add a date or a reminder if it needs one. To change or remove something later, use the pencil and bin on its row.",
    },
    {
      icon: "📅",
      title: "One calendar for both",
      body: "Events, deadlines and due to-dos in one place. Your private events show to the other person only as “Busy”.",
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
      localStorage.setItem(SEEN_KEY, changelog[0]?.title ?? "");
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
    q: "Adding, changing and deleting",
    a: [
      "Tap + to add a to-do or an event. Only the name is needed; everything else is under “More options”.",
      "The quick line at the top of a list understands dates: “call the venue tomorrow at 10”, “pay council tax Friday”, “every Monday”.",
      "Each to-do has a pencil (edit) and a bin (delete). Tapping the to-do's name opens it too.",
      "Tick the box when it's done. Ticked it by mistake? Untick it under Done.",
      "Deleted something by mistake? Tap Undo in the message that appears.",
    ],
  },
  {
    q: "Mine, joint and the colours",
    a: [
      "Backstage has two sides, Work and Personal; the switch is at the top. Work shows only your work tasks, work projects and work calendar. Nothing personal, joint or wedding appears there, and hearts and messages wait until you switch back.",
      "Each device remembers its side: a browser starts on Work, the phone app on Personal.",
      "My tasks: your own lists. Only you see them.",
      "Joint: the shared list. Either of you can add, edit and tick things off. A joint item can be for one of you or both.",
      "Blue = added by Umit, pink = added by Dilfiraz (the coloured edge on each card).",
      "Every project is a Work or a Personal one (you choose when you create it) and shows on that side. A personal project can be yours or joint.",
    ],
  },
  {
    q: "The wedding section",
    a: [
      "Wedding is for the two of you: you both see and can change all of it. Every to-do says who added it.",
      "A to-do can be left with no one yet, given to one of you, or be for both of you. The picker above the list sets who the to-dos you type there are for.",
      "Guest list tab: a list for each of you. Type a name and press Enter; “Ali Demir +1” counts as 2 and “Kaya family x4” as 4. You can paste a whole list at once. Tap a name to change it, use − and + for how many people the line stands for, ⇄ to move it to the other list.",
      "The total is counted against the places each of you has and what the venue holds (Edit details sets those).",
      "Areas (Venue, Catering, Decor…) each hold their own to-dos, budget and spend. Setting the date starts the countdown and puts the day on the joint calendar.",
    ],
  },
  {
    q: "Files on a task",
    a: [
      "Open a task and tap Attach to add files: PDF, Word, Excel, photos or anything else, up to 25 MB each. You can also attach them while creating a task, or drop them onto the list on a computer.",
      "Whoever can see the task can open, download and delete its files. Files on your own tasks are yours alone; files on joint and wedding tasks are for both of you.",
      "Photos open in Backstage. Other files open in a new tab on the website; in the phone app they are handed to the phone’s browser to download and open.",
      "A 📎 on a task shows how many files it has. Deleting a task deletes its files.",
    ],
  },
  {
    q: "The calendar",
    a: [
      "Tap a day to see its plan; double-click (or + Event) to add an event.",
      "Each event asks two things. Calendar: Work, Personal, Joint or Wedding. Who can see it: only you, or the other person too.",
      "An event only you can see is never sent to the other person. One you share shows on their calendar in your colour; they can read it but not change it. Joint and wedding events are seen, and can be changed, by both.",
      "Repeating events: changes and deletes apply to every repeat.",
    ],
  },
  {
    q: "The fun stuff (Us tab and Today)",
    a: [
      "❤️ in the top bar: sends a heart. Floating hearts pop up for the other person, whichever screen they are on.",
      "Mood: pick how you feel on the Today screen. The other person gets a pop-up and a buzz within seconds (🤗 = needs a hug).",
      "Countdowns: add a date (holiday, anniversary) and watch the days drop. Confetti on the day.",
      "Chore battle: ticking off a joint to-do scores a point (urgent = 2). Last week's winner wears the 👑.",
      "Nudge: open a joint to-do and tap 👉 Nudge. It lands in the chat (with a count, if it's become a habit…).",
      "Love notes: on a joint to-do you added, write a hidden note. It shows as 💌 for the other person and opens when they tap it.",
      "Us › Dinner: you both swipe through the same deck of dishes. Swipe left for yes (green tick), right for no (red cross). The first dish you both say yes to is dinner. Your own ideas go to the front.",
      "Us › Dates: the same swipe game as Dinner, with 50 date ideas plus your own. The first you both say yes to is your next date; book it for Saturday.",
      "Us › Memories: keep little moments; one pops up on Today now and then.",
      "Us › Gifts: a private list of gift ideas for the other person (they never see it), with a reminder two weeks before their birthday. Add your own birthday there too.",
      "One-time video: Umit can send a video from his Today screen (Choose video). Dilfiraz gets a 🎁 card; it plays once, then it is deleted. Closing it part-way also uses it up.",
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
      "No reminders on the phone: Settings › Apps › Backstage › Notifications on; also allow “Alarms & reminders”. Samsung/Xiaomi: Battery › Unrestricted.",
      "“Too many wrong passwords”: wait 15 minutes. Forgotten a password? Umit can set a new one.",
      "New features arrive by themselves: close and reopen the app. You only download the app again for a new phone.",
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
          <a className="bs-link" href="/app/updates" target="_blank" rel="noreferrer">
            What&rsquo;s new
          </a>
        </div>
      </div>
    </div>
  );
}

// ——— what's new: shown once after each update that adds a changelog entry ———
const SEEN_KEY = "backstage:seen-update";

export function shouldShowNew(): boolean {
  try {
    return !!changelog[0] && localStorage.getItem(SEEN_KEY) !== changelog[0].title;
  } catch {
    return false;
  }
}

export function WhatsNew({ onClose }: { onClose: () => void }) {
  const c = changelog[0];
  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, c?.title ?? "");
    } catch {
      /* fine */
    }
    onClose();
  };
  if (!c) return null;
  return (
    <div className="bs-scrim center">
      <div className="bs-welcome" role="dialog" aria-modal="true" aria-labelledby="new-h">
        <div className="icon" aria-hidden="true">
          ✨
        </div>
        <span className="quiet small">Backstage has been updated</span>
        <h2 id="new-h">{c.title}</h2>
        <ul className="bs-newlist">
          {c.items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <div className="bs-drawer-foot">
          <a className="bs-link" href="/app/updates" target="_blank" rel="noreferrer">
            All updates
          </a>
          <button className="btn" onClick={finish} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
