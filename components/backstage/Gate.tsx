"use client";

// The door to Backstage: your name and your password.
import { useEffect, useState } from "react";
import type { Backstage } from "./useBackstage";

export default function Gate({ bs }: { bs: Backstage }) {
  const { phase } = bs;
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      setName(localStorage.getItem("backstage:last-user") ?? "");
    } catch {
      /* fine */
    }
  }, []);
  return (
    <div className="bs-gate">
      <div className="bs-card">
        <h1>Backstage</h1>
        <p className="sub">Umit &amp; Dilfiraz&rsquo;s planner</p>
        {phase.kind === "loading" && <p className="notice">Opening…</p>}
        {phase.kind === "noconfig" && (
          <p className="notice">
            Backstage isn&rsquo;t set up on this server yet: the{" "}
            <code>{phase.missing}</code> setting is missing. Add it where the
            site is hosted, redeploy, and reload this page.
          </p>
        )}
        {phase.kind === "locked" && (
          <>
            <p className="notice">{phase.message}</p>
            <button className="btn wide" onClick={() => window.location.reload()}>
              Reload
            </button>
          </>
        )}
        {phase.kind === "signin" && phase.reason && <p className="notice warn">{phase.reason}</p>}
        {phase.kind === "signin" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const password = String(f.get("password") ?? "");
              const username = String(f.get("username") ?? "").trim();
              setErr("");
              setBusy(true);
              const problem = await bs.signIn(username, password);
              if (!problem) {
                try {
                  localStorage.setItem("backstage:last-user", username);
                } catch {
                  /* fine */
                }
              }
              setErr(problem);
              setBusy(false);
            }}
          >
            <label htmlFor="f-user">Name</label>
            <div className="bs-who-pick" role="group" aria-label="Who are you?">
              {["Umit", "Dilfiraz"].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-pressed={name.toLowerCase() === n.toLowerCase()}
                  className={n.toLowerCase()}
                  onClick={() => {
                    setName(n);
                    (document.getElementById("f-pass") as HTMLInputElement | null)?.focus();
                  }}
                >
                  <span className="bs-avatar">{n[0]}</span>
                  {n}
                </button>
              ))}
            </div>
            <input
              id="f-user"
              name="username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="words"
              spellCheck={false}
              className="bs-user-input"
            />
            <label htmlFor="f-pass">Password</label>
            <div className="bs-pass">
              <input
                id="f-pass"
                name="password"
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="bs-eye"
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                onClick={() => setShow((v) => !v)}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {show && <path d="M4 4l16 16" />}
                </svg>
              </button>
            </div>
            <p className="error-line" role="alert">
              {err}
            </p>
            <button className="btn wide" type="submit" disabled={busy}>
              {busy ? "Checking…" : "Open Backstage"}
            </button>
          </form>
        )}
      </div>
      <p className="bs-gate-foot">
        <a className="bs-back" href="/">
          Back to the site
        </a>
      </p>
      <p className="bs-gate-help">Forgotten your password? Umit can set a new one.</p>
    </div>
  );
}
