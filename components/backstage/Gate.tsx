"use client";

// The door to Backstage: sign in, create the account, confirm the email.
import { useEffect, useRef, useState } from "react";
import type { Backstage } from "./useBackstage";

export default function Gate({ bs }: { bs: Backstage }) {
  const { phase } = bs;
  return (
    <div className="bs-gate">
      <div className="bs-card">
        <h1>Backstage</h1>
        <p className="sub">The private production office for umitbozdag.com</p>
        {phase.kind === "loading" && <p className="notice">Opening…</p>}
        {phase.kind === "noconfig" && (
          <p className="notice">
            Backstage isn&rsquo;t connected yet. The server needs its Neon
            settings (<code>DATABASE_URL</code>, <code>NEON_AUTH_BASE_URL</code>,{" "}
            <code>NEON_AUTH_JWKS_URL</code>). Add them where the site is hosted,
            redeploy, and reload this page.
          </p>
        )}
        {phase.kind === "locked" && (
          <>
            <p className="notice">{phase.message}</p>
            <button className="btn wide" onClick={bs.signOut}>
              Sign out
            </button>
          </>
        )}
        {(phase.kind === "signin" || phase.kind === "signup") && (
          <SignForm bs={bs} mode={phase.kind} />
        )}
        {phase.kind === "verify" && <VerifyForm bs={bs} email={phase.email} />}
      </div>
      <a className="bs-back" href="/">
        Back to the site
      </a>
    </div>
  );
}

function SignForm({ bs, mode }: { bs: Backstage; mode: "signin" | "signup" }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === "signup";
  return (
    <>
      <button
        type="button"
        className="btn ghost wide"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(await bs.signInWithGoogle());
          setBusy(false);
        }}
      >
        Continue with Google
      </button>
      <p className="or">or with a password</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const email = String(fd.get("email") ?? "").trim();
          const password = String(fd.get("password") ?? "");
          setErr("");
          setBusy(true);
          setErr(
            isSignUp
              ? await bs.signUp(String(fd.get("name") ?? "").trim(), email, password)
              : await bs.signIn(email, password)
          );
          setBusy(false);
        }}
      >
        {isSignUp && (
          <>
            <label htmlFor="f-name">Your name</label>
            <input id="f-name" name="name" maxLength={80} autoComplete="name" />
          </>
        )}
        <label htmlFor="f-email">Email</label>
        <input id="f-email" name="email" type="email" required autoComplete="username" />
        <label htmlFor="f-pass">Password</label>
        <input
          id="f-pass"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
        <p className="error-line" role="alert">
          {err}
        </p>
        <button className="btn wide" type="submit" disabled={busy}>
          {busy ? "One moment…" : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="switch">
        {isSignUp ? "Already have an account? " : "First visit? "}
        <button
          type="button"
          onClick={() => bs.setPhase({ kind: isSignUp ? "signin" : "signup" })}
        >
          {isSignUp ? "Sign in" : "Create account"}
        </button>
      </p>
    </>
  );
}

function VerifyForm({ bs, email }: { bs: Backstage; email: string }) {
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);

  // Ask for a code once on arrival; sign-up may already have sent one, and a
  // second code simply replaces the first.
  useEffect(() => {
    if (sent.current || !email) return;
    sent.current = true;
    bs.sendCode(email).then((e) => {
      if (e) setErr(e);
      else setInfo(`We emailed a 6-digit code to ${email}.`);
    });
  }, [bs, email]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get("code") ?? "");
        setErr("");
        setBusy(true);
        setErr(await bs.verifyCode(email, code));
        setBusy(false);
      }}
    >
      <p className="notice">
        Backstage only opens for a confirmed email address. {info}
      </p>
      <label htmlFor="f-code">Code from the email</label>
      <input
        id="f-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        minLength={4}
        maxLength={8}
        autoFocus
      />
      <p className="error-line" role="alert">
        {err}
      </p>
      <button className="btn wide" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Confirm email"}
      </button>
      <p className="switch">
        <button
          type="button"
          onClick={async () => {
            setErr(await bs.sendCode(email));
            setInfo(`A new code is on its way to ${email}.`);
          }}
        >
          Send a new code
        </button>
        {" or "}
        <button type="button" onClick={bs.signOut}>
          use a different account
        </button>
      </p>
    </form>
  );
}
