"use client";

// A video one person sends the other to watch once. Umit picks a file on his
// dashboard; Dilfiraz gets a card, plays it full screen, and when it ends (or
// she closes it) it is deleted for good.
import { useEffect, useRef, useState } from "react";
import { BUZZ, buzz } from "./native";

export type VideoIn = { id: string; from_user: string; note: string | null; created_at: string };
export type VideoOut = { id: string; to_user: string; ready: boolean; created_at: string; opened_at: string | null; watched_at: string | null };

const MAX_MB = 150;
const at = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

async function call(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const r = await fetch(`/api/backstage${path}`, { credentials: "same-origin", ...init });
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "That didn't work. Try again.");
  return d;
}

// ——— sender (Umit's dashboard) ———
export function VideoSender({ toName, out, onChanged, say }: { toName: string; out: VideoOut | null; onChanged: () => void; say: (m: string, tone?: "info" | "error") => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<{ pct: number; name: string } | null>(null);
  const [again, setAgain] = useState(false);
  const stop = useRef(false);

  const send = async (file: File) => {
    if (!file.type.startsWith("video/")) return say("Pick a video file.", "error");
    if (file.size > MAX_MB * 1048576) return say(`That video is ${Math.round(file.size / 1048576)} MB. The limit is ${MAX_MB} MB: trim it or pick a shorter one.`, "error");
    stop.current = false;
    setBusy({ pct: 0, name: file.name });
    try {
      const start = await call("/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mime: file.type, size: file.size, note }) });
      const id = String(start.id);
      const chunk = Number(start.chunk);
      const total = Math.ceil(file.size / chunk);
      for (let i = 0; i < total; i++) {
        if (stop.current) throw new Error("Upload stopped.");
        const part = file.slice(i * chunk, (i + 1) * chunk);
        for (let attempt = 1; ; attempt++) {
          try {
            await call(`/video/${id}/chunk?i=${i}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: part });
            break;
          } catch (e) {
            if (attempt >= 4) throw e;
            await new Promise((r) => setTimeout(r, 1200 * attempt));
          }
        }
        setBusy({ pct: Math.round(((i + 1) / total) * 100), name: file.name });
      }
      await call(`/video/${id}/done`, { method: "POST" });
      setNote("");
      setAgain(false);
      say(`Sent. ${toName} can watch it once.`);
      onChanged();
    } catch (e) {
      say((e as Error).message || "The upload failed. Try again.", "error");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const waiting = out && !out.watched_at;
  const watched = out?.watched_at && Date.now() - new Date(out.watched_at).getTime() < 7 * 86_400_000;

  return (
    <section className="bs-video-card" aria-label={`A video for ${toName}`}>
      <span className="e" aria-hidden="true">
        🎬
      </span>
      <div className="txt">
        {busy ? (
          <>
            <strong>Uploading… {busy.pct}%</strong>
            <div className="bar" role="progressbar" aria-valuenow={busy.pct} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${busy.pct}%` }} />
            </div>
            <span className="quiet small">Keep Backstage open until it reaches 100%.</span>
          </>
        ) : waiting && !again ? (
          <>
            <strong>{out.opened_at ? `${toName} is watching your video…` : `Your video is waiting for ${toName}`}</strong>
            <span className="quiet small">Sent {at(out.created_at)}. It plays once, then it&rsquo;s deleted.</span>
          </>
        ) : watched && !again ? (
          <>
            <strong>{toName} watched your video ❤️</strong>
            <span className="quiet small">{at(out!.watched_at!)}. It has been deleted.</span>
          </>
        ) : (
          <>
            <strong>Send {toName} a video</strong>
            <span className="quiet small">It plays once on {toName}&rsquo;s screen, then it&rsquo;s deleted. Up to {MAX_MB} MB.</span>
            <input className="note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="A few words to go with it (optional)" aria-label="Note" />
          </>
        )}
      </div>
      <div className="acts">
        {busy ? (
          <button className="btn ghost" onClick={() => (stop.current = true)}>
            Stop
          </button>
        ) : waiting && !again ? (
          <>
            {!out.opened_at && (
              <button
                className="btn ghost"
                onClick={() =>
                  call(`/video/${out.id}`, { method: "DELETE" }).then(
                    () => {
                      say("Taken back.");
                      onChanged();
                    },
                    (e) => say((e as Error).message, "error")
                  )
                }
              >
                Take it back
              </button>
            )}
          </>
        ) : watched && !again ? (
          <button className="btn ghost" onClick={() => setAgain(true)}>
            Send another
          </button>
        ) : (
          <button className="btn" onClick={() => input.current?.click()}>
            Choose video
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && void send(e.target.files[0])} />
    </section>
  );
}

// ——— receiver: the card on the dashboard ———
export function VideoWaiting({ fromName, video, onWatch }: { fromName: string; video: VideoIn; onWatch: () => void }) {
  return (
    <section className="bs-video-card gift" aria-label={`A video from ${fromName}`}>
      <span className="e" aria-hidden="true">
        🎁
      </span>
      <div className="txt">
        <strong>{fromName} has a video for you</strong>
        <span className="quiet small">{video.note ? `“${video.note}” · ` : ""}You can watch it once.</span>
      </div>
      <div className="acts">
        <button className="btn" onClick={onWatch}>
          Watch now
        </button>
      </div>
    </section>
  );
}

// ——— receiver: the prompt, then the player ———
export function VideoGift({ fromName, video, autoPrompt, playing, onPlay, onLater, onDone, onHeart }: {
  fromName: string;
  video: VideoIn;
  autoPrompt: boolean;
  playing: boolean;
  onPlay: () => void;
  onLater: () => void;
  onDone: () => void;
  onHeart: () => void;
}) {
  const v = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "paused" | "ended" | "error" | "tap">("loading");
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(false);

  const burn = () => fetch(`/api/backstage/video/${video.id}/watched`, { method: "POST", credentials: "same-origin" }).catch(() => {});

  useEffect(() => {
    if (!playing) return;
    const el = v.current;
    if (!el) return;
    el.play().then(
      () => undefined,
      () => setState("tap") // the phone wants one more tap before it plays sound
    );
  }, [playing]);

  // closing the app or the tab part-way through still counts as its one showing
  useEffect(() => {
    if (!playing) return;
    const bye = () => {
      if (started.current) navigator.sendBeacon?.(`/api/backstage/video/${video.id}/watched`);
    };
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [playing, video.id]);

  if (!playing) {
    if (!autoPrompt) return null;
    return (
      <div className="bs-scrim center">
        <div className="bs-welcome bs-gift" role="dialog" aria-modal="true" aria-labelledby="gift-h">
          <div className="icon big" aria-hidden="true">
            🎁
          </div>
          <h2 id="gift-h">{fromName} has a video for you</h2>
          {video.note && <p className="note">“{video.note}”</p>}
          <p>You can watch it <strong>once</strong>. When it ends, it&rsquo;s gone, so pick a good moment and turn the sound up.</p>
          <div className="bs-drawer-foot">
            <button className="bs-link" onClick={onLater}>
              Later
            </button>
            <button className="btn" onClick={onPlay} autoFocus>
              Watch now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bs-player" role="dialog" aria-modal="true" aria-label={`Video from ${fromName}`} onContextMenu={(e) => e.preventDefault()}>
      {state !== "ended" && state !== "error" && (
        <video
          ref={v}
          src={`/api/backstage/video/${video.id}/stream`}
          playsInline
          preload="auto"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate noremoteplayback"
          onPlaying={() => {
            started.current = true;
            setState("playing");
          }}
          onPause={() => setState((s) => (s === "playing" ? "paused" : s))}
          onWaiting={() => setState((s) => (s === "playing" ? "loading" : s))}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration > 0) setPct((el.currentTime / el.duration) * 100);
          }}
          onEnded={() => {
            setState("ended");
            void burn();
            buzz(BUZZ.message);
          }}
          onError={() => setState("error")}
          onClick={(e) => {
            const el = e.currentTarget;
            if (el.paused) void el.play();
            else el.pause();
          }}
        />
      )}
      {(state === "loading" || state === "tap" || state === "paused") && (
        <button className="bs-player-mid" onClick={() => void v.current?.play()}>
          {state === "loading" ? "Loading…" : state === "tap" ? "▶ Tap to play" : "▶ Paused. Tap to carry on"}
        </button>
      )}
      {state !== "ended" && state !== "error" && (
        <>
          <div className="bs-player-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          <button className="bs-player-x" aria-label="Close" onClick={() => (started.current ? setLeaving(true) : onLater())}>
            ×
          </button>
        </>
      )}
      {leaving && state !== "ended" && (
        <div className="bs-player-ask">
          <p>
            <strong>Close it now and it&rsquo;s gone.</strong> You can&rsquo;t watch it again.
          </p>
          <div className="bs-row-btns center">
            <button
              className="btn"
              onClick={() => {
                setLeaving(false);
                void v.current?.play();
              }}
            >
              Keep watching
            </button>
            <button
              className="btn ghost light"
              onClick={() => {
                void burn();
                onDone();
              }}
            >
              Close anyway
            </button>
          </div>
        </div>
      )}
      {state === "ended" && (
        <div className="bs-player-end">
          <span className="e" aria-hidden="true">
            💝
          </span>
          <h2>That was it</h2>
          <p>The video has been deleted. Only you got to see it.</p>
          <div className="bs-row-btns center">
            <button
              className="btn"
              onClick={() => {
                onHeart();
                onDone();
              }}
            >
              ❤️ Send {fromName} a heart
            </button>
            <button className="btn ghost light" onClick={onDone}>
              Close
            </button>
          </div>
        </div>
      )}
      {state === "error" && (
        <div className="bs-player-end">
          <span className="e" aria-hidden="true">
            😕
          </span>
          <h2>It won&rsquo;t play here</h2>
          <p>The video stopped or can&rsquo;t play on this device. It hasn&rsquo;t been used up: try again in a moment, or on another device.</p>
          <div className="bs-row-btns center">
            <button className="btn" onClick={onLater}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
