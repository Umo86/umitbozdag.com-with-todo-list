"use client";

// You: who's signed in, your private calendar link for Google / Samsung
// Calendar, reminder settings on the phone, and signing out.
import { useEffect, useState } from "react";
import { exactAlarms, isApp, openExactAlarmSetting, prepareNotifications } from "./native";
import type { Me } from "./types";
import type { Backstage } from "./useBackstage";

export default function Settings({ bs, me, onClose }: { bs: Backstage; me: Me; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);
  const [exact, setExact] = useState<"granted" | "denied" | "n/a">("n/a");
  const [notif, setNotif] = useState<string>("");

  useEffect(() => {
    bs.api<{ calendar_url: string }>("/me").then((r) => setUrl(r.calendar_url), () => setUrl(""));
    void exactAlarms().then(setExact);
    if (!isApp() && "Notification" in window) setNotif(Notification.permission);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bs, onClose]);

  const webcal = url.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  return (
    <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bs-drawer bs-sheet" role="dialog" aria-modal="true" aria-labelledby="set-h">
        <div className="bs-grab" aria-hidden="true" />
        <div className="bs-drawer-head">
          <h2 id="set-h">You</h2>
          <button className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="bs-me">
          <span className="bs-avatar big" style={{ background: me.color }}>
            {me.name[0]}
          </span>
          <div>
            <strong>{me.name}</strong>
            <span className="quiet">Things you add show in {me.id === "umit" ? "blue" : "pink"}.</span>
          </div>
        </div>

        <h3 className="bs-sub">Your calendar in Google or Samsung Calendar</h3>
        <p className="bs-hint">
          Add this private link once and your events, joint events and deadlines appear in your phone&rsquo;s calendar
          too (read-only, refreshed every few hours). Keep it to yourself: anyone with the link can see them.
        </p>
        {url ? (
          <>
            <input className="bs-copy" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Calendar link" />
            <div className="bs-row-btns">
              <button
                className="btn"
                onClick={() =>
                  navigator.clipboard?.writeText(url).then(
                    () => bs.say("Link copied."),
                    () => bs.say("Press and hold the link to copy it.")
                  )
                }
              >
                Copy link
              </button>
              <a className="btn ghost" href={google} target="_blank" rel="noreferrer">
                Add to Google Calendar
              </a>
            </div>
            {confirmNew ? (
              <p className="bs-hint">
                The old link will stop working.{" "}
                <button
                  className="bs-link danger"
                  onClick={() =>
                    bs.api<{ calendar_url: string }>("/me", { method: "POST", body: {} }).then((r) => {
                      setUrl(r.calendar_url);
                      setConfirmNew(false);
                      bs.say("New link made.");
                    })
                  }
                >
                  Make a new link
                </button>{" "}
                <button className="bs-link" onClick={() => setConfirmNew(false)}>
                  Keep this one
                </button>
              </p>
            ) : (
              <button className="bs-link" onClick={() => setConfirmNew(true)}>
                Shared it by mistake? Make a new link
              </button>
            )}
          </>
        ) : (
          <p className="quiet">Loading your link…</p>
        )}

        <h3 className="bs-sub">Reminders</h3>
        {isApp() ? (
          <>
            <p className="bs-hint">Reminders are set on this phone, so they go off even when the app is closed.</p>
            <div className="bs-row-btns">
              <button
                className="btn ghost"
                onClick={() =>
                  prepareNotifications().then((p) =>
                    bs.say(p === "granted" ? "Notifications are on." : "Turn on notifications for Backstage in Android settings.")
                  )
                }
              >
                Check notifications
              </button>
              {exact === "denied" && (
                <button className="btn ghost" onClick={() => void openExactAlarmSetting()}>
                  Allow on-time reminders
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="bs-hint">
            In a browser, reminders pop up while Backstage is open
            {notif === "granted" ? " (alerts are on)" : ""}. Install the Android app to get them with Backstage closed.
          </p>
        )}

        <div className="bs-drawer-foot">
          <span className="quiet small">Backstage · umitbozdag.com</span>
          <button className="btn ghost" onClick={bs.signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
