"use client";

// The contact form, worn as a delegate badge: it hangs on a lanyard round a
// neck and swings once as it comes into view. Messages go to /api/contact;
// if that can't take them, the visitor's own email app opens instead.
import { useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { SITE } from "@/lib/content";

const BARS = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 4, 1, 2, 2, 1, 3, 1, 1, 2, 4, 1, 2];
type State = "idle" | "sending" | "sent";

export default function ContactBadge() {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const swing = () => {
    if (reduce) return;
    controls.start({
      rotate: [5, -3, 1.8, -0.8, 0],
      transition: { duration: 2.4, ease: "easeInOut", times: [0, 0.28, 0.55, 0.8, 1] },
    });
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries()) as Record<string, string>;
    setError("");
    setState("sending");
    const mailto = () => {
      const text = `${body.message}\n\n${body.name}${body.company ? `, ${body.company}` : ""}`;
      window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
        `Message from ${body.name}`
      )}&body=${encodeURIComponent(text)}`;
    };
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, client: deviceInfo() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; fallback?: boolean };
      if (res.ok) {
        setState("sent");
        form.reset();
        return;
      }
      setState("idle");
      if (data.fallback) {
        setError("Opening your email app to send this instead.");
        mailto();
      } else {
        setError(data.error ?? "That didn't send. Try again, or email me directly.");
      }
    } catch {
      setState("idle");
      setError("That didn't send. Opening your email app instead.");
      mailto();
    }
  }

  return (
    <div className="neck">
      <svg className="neck__lines" viewBox="0 0 420 210" aria-hidden="true">
        {/* neck and shoulders */}
        <path className="neck__body" d="M168 0 V46 C168 78 120 92 44 106 C14 112 2 128 0 160" />
        <path className="neck__body" d="M252 0 V46 C252 78 300 92 376 106 C406 112 418 128 420 160" />
        {/* lanyard, down both sides of the neck to the clip */}
        <path className="neck__strap" d="M170 30 C184 110 204 172 210 204" />
        <path className="neck__strap" d="M250 30 C236 110 216 172 210 204" />
      </svg>
      <motion.div
        className="cbadge-rig"
        animate={controls}
        style={{ transformOrigin: "50% -60px" }}
        onViewportEnter={swing}
        viewport={{ once: true, margin: "-120px" }}
      >
        <span className="badge-clip" aria-hidden="true" />
        <form className={`cbadge${state === "sent" ? " is-sent" : ""}`} onSubmit={onSubmit} noValidate={false}>
          <div className="badge-band" aria-hidden="true">
            Visitor
          </div>
          <div className="cbadge__body">
            <h3>Send me a message</h3>
            <div className="cbadge__fields">
              <label className="field">
                <span>Your name</span>
                <input name="name" required maxLength={120} autoComplete="name" />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" required maxLength={200} autoComplete="email" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input name="phone" type="tel" required minLength={7} maxLength={30} autoComplete="tel" inputMode="tel" pattern="[0-9+()\-\s.]{7,30}" title="A phone number, e.g. +44 7700 900123" />
              </label>
              <label className="field">
                <span>Company (optional)</span>
                <input name="company" maxLength={160} autoComplete="organization" />
              </label>
              <label className="field field--full">
                <span>How can I help?</span>
                <textarea name="message" rows={4} required minLength={5} maxLength={4000} />
              </label>
              <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            </div>
            <div className="cbadge__actions">
              <button className="btn" type="submit" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Send message"}
              </button>
              <span className="cbadge__status" role="status" aria-live="polite">
                {error}
              </span>
            </div>
            <div className="cbadge__done" role="status">
              <strong>Thanks, I&rsquo;ll contact you shortly.</strong>
              <button type="button" className="textbtn" onClick={() => setState("idle")}>
                Send another
              </button>
            </div>
          </div>
          <div className="badge-foot" aria-hidden="true">
            <span className="badge-bars">
              {BARS.map((w, i) => (
                <i key={i} style={{ width: w }} />
              ))}
            </span>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// What the browser can tell us about the sender's device (sent with the message).
const LOADED = typeof performance !== "undefined" ? Date.now() - performance.now() : Date.now();
function deviceInfo(): Record<string, string | number | boolean> {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number }; userAgentData?: { platform?: string } };
  const secs = Math.round((Date.now() - LOADED) / 1000);
  return {
    page: location.href,
    referrer: document.referrer,
    localTime: new Date().toString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}×${screen.height}`,
    viewport: `${innerWidth}×${innerHeight}`,
    pixelRatio: devicePixelRatio,
    touch: navigator.maxTouchPoints > 0 ? `yes (${navigator.maxTouchPoints} points)` : "no",
    platform: n.userAgentData?.platform || navigator.platform,
    languages: (navigator.languages ?? [navigator.language]).join(", "),
    cores: navigator.hardwareConcurrency ?? "",
    memory: n.deviceMemory ?? "",
    connection: n.connection ? `${n.connection.effectiveType ?? ""}${n.connection.downlink ? `, ~${n.connection.downlink} Mbps` : ""}` : "",
    darkMode: matchMedia("(prefers-color-scheme: dark)").matches ? "yes" : "no",
    cookies: navigator.cookieEnabled ? "yes" : "no",
    dnt: navigator.doNotTrack === "1" ? "on" : "off",
    timeOnPage: secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} s`,
  };
}
