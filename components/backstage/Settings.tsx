"use client";

// You: who's signed in, help, reminder and notification settings, and
// signing out.
import { useEffect, useState } from "react";
import { exactAlarms, forgetPush, hasPush, isApp, openExactAlarmSetting, prepareNotifications } from "./native";
import { disablePush, enablePush, pushState, type PushState } from "./push";
import type { Me, Space } from "./types";
import type { Backstage } from "./useBackstage";

export default function Settings({ bs, me, space, onClose, onHelp }: { bs: Backstage; me: Me; space: Space; onClose: () => void; onHelp: () => void }) {
  const [exact, setExact] = useState<"granted" | "denied" | "n/a">("n/a");
  const [notif, setNotif] = useState<string>("");
  const [push, setPush] = useState<PushState>("unsupported");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    void exactAlarms().then(setExact);
    void pushState().then(setPush);
    if (!isApp() && "Notification" in window) setNotif(Notification.permission);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bs, onClose]);

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

        <button className="bs-helprow" onClick={onHelp}>
          <span aria-hidden="true">?</span>
          How Backstage works, tips and fixes
        </button>

        <h3 className="bs-sub">Reminders and notifications</h3>
        {isApp() ? (
          <>
            <p className="bs-hint">
              Reminders are set on this phone, so they go off even when the app is closed.{" "}
              {hasPush()
                ? "Hearts, messages and changes to joint to-dos arrive as notifications too, even with the app closed."
                : "Hearts and messages show when you open the app; a newer version of the app delivers them as notifications when it is closed."}
            </p>
            <div className="bs-row-btns">
              {hasPush() && (
                <button
                  className="btn ghost"
                  onClick={() => {
                    bs.say("A test notification is coming in about 6 seconds. Close the app now to see it arrive.");
                    bs.api("/push/test", { method: "POST", body: {} }).catch((e: Error) => bs.say(e.message, "error"));
                  }}
                >
                  Send me a test notification
                </button>
              )}
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
          <>
            <p className="bs-hint">
              {space === "work"
                ? "Notifications on this device are for personal things (messages and joint to-dos), and they pop up whichever side is open. On a work computer, leave them off."
                : `Get a notification on this ${/Android|iPhone|Mobile/i.test(navigator.userAgent) ? "phone" : "computer"} when ${
                    me.id === "umit" ? "Dilfiraz" : "Umit"
                  } messages you, sends a heart or a nudge, or adds something joint, even with Backstage closed.`}
              {notif === "granted" ? "" : ""}
            </p>
            {push === "unsupported" ? (
              <p className="bs-hint">This browser can&rsquo;t do that. Use Chrome, Edge or Firefox.</p>
            ) : push === "blocked" ? (
              <p className="bs-hint">Notifications are blocked for this site. Click the lock icon next to the address, allow Notifications, then reload.</p>
            ) : (
              <div className="bs-row-btns">
                {push === "on" ? (
                  <>
                    <span className="bs-on">✓ Notifications are on here</span>
                    <button
                      className="btn ghost"
                      disabled={pushBusy}
                      onClick={async () => {
                        setPushBusy(true);
                        await disablePush(bs.api);
                        setPush(await pushState());
                        setPushBusy(false);
                        bs.say("Notifications are off on this device.");
                      }}
                    >
                      Turn off
                    </button>
                  </>
                ) : (
                  <button
                    className="btn"
                    disabled={pushBusy}
                    onClick={async () => {
                      setPushBusy(true);
                      const err = await enablePush(bs.pushKey, bs.api);
                      setPush(await pushState());
                      setPushBusy(false);
                      bs.say(err || "Notifications are on. You should get a test one now.", err ? "error" : "info");
                    }}
                  >
                    Turn on notifications
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <div className="bs-drawer-foot">
          <a className="bs-link" href="/app/updates" target="_blank" rel="noreferrer">
            What&rsquo;s new · version {(process.env.NEXT_PUBLIC_BUILD_ID || "dev").slice(0, 7)}
          </a>
          <button
            className="btn ghost"
            onClick={() => {
              // this phone stops getting your notifications, then sign out
              void forgetPush((token) => bs.api("/push/fcm", { method: "DELETE", body: { token } })).finally(bs.signOut);
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
