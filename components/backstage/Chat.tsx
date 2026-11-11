"use client";

// Chat between Umit and Dilfiraz. Your messages on the right in your colour,
// theirs on the left in theirs. Tap a message to copy it or turn it into a
// joint to-do. "Seen" shows under your last message once they've read it.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseTask } from "@/lib/parse";
import { colorOf, nameOf, softOf, type ChatMessage, type Me, type Person } from "./types";
import type { Backstage } from "./useBackstage";

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function Chat({ bs, me, users }: { bs: Backstage; me: Me; users: Person[] }) {
  const other = users.find((u) => u.id !== me.id);
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const msgs = bs.chat;

  // load everything once, and mark as read while the chat is on screen
  useEffect(() => {
    bs.pollChat(true).then(
      () => {
        setLoaded(true);
        void bs.markChatRead();
      },
      (e: Error) => setLoadErr(e.message)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (loaded && bs.chatUnread > 0) void bs.markChatRead();
  }, [loaded, bs.chatUnread, bs]);
  useLayoutEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, loaded]);

  // grow the box with the text, up to five lines
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const send = async (body: string, kind: "text" | "heart" = "text") => {
    if (!body.trim()) return;
    if (kind === "text") setText("");
    const ok = await bs.sendChat(body.trim(), kind);
    if (!ok && kind === "text") setText(body);
  };

  const myLast = [...msgs].reverse().find((m) => m.sender === me.id && !m.pending && !m.failed);
  const seen = myLast && bs.seenUpTo && new Date(bs.seenUpTo) >= new Date(myLast.created_at);

  let lastDay = "";
  return (
    <div className="bs-chat">
      <div className="bs-chat-head">
        <span className="bs-avatar" style={{ background: other?.color ?? "#999" }}>
          {other?.name[0] ?? "?"}
        </span>
        <div>
          <strong>{other?.name ?? "Chat"}</strong>
          <span className="quiet small">Only the two of you can see this.</span>
        </div>
      </div>

      <div className="bs-chat-list" role="log" aria-live="polite" aria-label={`Chat with ${other?.name ?? ""}`}>
        {loadErr && (
          <div className="bs-chat-err" role="alert">
            {loadErr}{" "}
            <button className="bs-link" onClick={() => bs.pollChat(true).then(() => setLoadErr(""), (e: Error) => setLoadErr(e.message))}>
              Try again
            </button>
          </div>
        )}
        {loaded && !msgs.length && (
          <div className="bs-chat-empty">
            <p>
              No messages yet. Say hello to {other?.name ?? "each other"} 👋
            </p>
            <button className="btn ghost" onClick={() => send("❤️", "heart")}>
              Send a ❤️
            </button>
          </div>
        )}
        {msgs.map((m: ChatMessage) => {
          const mine = m.sender === me.id;
          const day = dayLabel(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && <div className="bs-chat-day">{day}</div>}
              <div className={`bs-msg ${mine ? "mine" : "theirs"}${m.kind === "heart" ? " heart" : ""}${m.kind === "nudge" ? " nudge" : ""}${m.failed ? " failed" : ""}`}>
                <button
                  className="bubble"
                  style={
                    m.kind === "heart"
                      ? undefined
                      : m.kind === "nudge"
                        ? { borderColor: colorOf(m.sender), color: colorOf(m.sender) }
                        : mine
                          ? { background: colorOf(m.sender) }
                          : { background: softOf(m.sender) }
                  }
                  onClick={() => setOpen(open === m.id ? null : m.id)}
                  aria-expanded={open === m.id}
                  aria-label={`${mine ? "You" : nameOf(m.sender)} at ${time(m.created_at)}: ${m.body}`}
                >
                  {m.body}
                </button>
                <span className="meta">
                  {m.failed ? (
                    <>
                      Not sent ·{" "}
                      <button
                        className="bs-link danger"
                        onClick={() => {
                          bs.dropChat(m.id);
                          void send(m.body, m.kind === "heart" ? "heart" : "text");
                        }}
                      >
                        Retry
                      </button>
                    </>
                  ) : m.pending ? (
                    "Sending…"
                  ) : (
                    time(m.created_at)
                  )}
                  {mine && myLast?.id === m.id && seen ? " · Seen" : ""}
                </span>
                {open === m.id && (
                  <div className="acts">
                    {mine && !m.pending && (
                      <button
                        onClick={() => {
                          bs.deleteChat(m.id);
                          setOpen(null);
                        }}
                      >
                        Delete
                      </button>
                    )}
                    {m.kind === "text" && <button
                      onClick={() => {
                        const d = parseTask(m.body, { others: users.filter((u) => u.id !== me.id) });
                        if (!d) return;
                        void bs
                          .addDrafts([{ ...d, kind: "task" as const, joint: true, assignee: d.assignee ?? "both" }], "personal")
                          .then((n) => n && bs.say("Added to the joint list."));
                        setOpen(null);
                      }}
                    >
                      + Joint to-do
                    </button>}
                    {m.kind === "text" && <button
                      onClick={() => {
                        navigator.clipboard?.writeText(m.body).then(() => bs.say("Copied."), () => bs.say("Couldn't copy.", "error"));
                        setOpen(null);
                      }}
                    >
                      Copy
                    </button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <form
        className="bs-chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <button type="button" className="heart" aria-label="Send a heart" onClick={() => send("❤️", "heart")}>
          ❤️
        </button>
        <textarea
          ref={box}
          rows={1}
          value={text}
          maxLength={4000}
          placeholder={`Message ${other?.name ?? ""}`}
          aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              void send(text);
            }
          }}
        />
        <button type="submit" className="send" disabled={!text.trim()} aria-label="Send" style={{ background: me.color }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
