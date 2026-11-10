"use client";

// Messages sent through the site's contact form.
import { useState } from "react";
import type { Message } from "./types";
import type { Backstage } from "./useBackstage";

export default function Messages({ bs, messages }: { bs: Backstage; messages: Message[] }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!messages.length) {
    return (
      <p className="bs-empty">
        No messages yet. Anything sent through the contact form on the site lands here.
      </p>
    );
  }
  return (
    <ul className="bs-msgs">
      {messages.map((m) => (
        <li key={m.id} className={m.read_at ? "read" : "unread"}>
          <div className="bs-msg-head">
            <strong>{m.name}</strong>
            {m.company && <span>{m.company}</span>}
            <time dateTime={m.created_at}>
              {new Date(m.created_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
          <p className="bs-msg-body">{m.message}</p>
          <div className="bs-msg-foot">
            <a
              className="btn"
              href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message")}`}
              onClick={() => !m.read_at && bs.patchMessage(m.id, true)}
            >
              Reply to {m.email}
            </a>
            <button className="bs-link" onClick={() => bs.patchMessage(m.id, !m.read_at)}>
              {m.read_at ? "Mark unread" : "Mark read"}
            </button>
            {confirm === m.id ? (
              <span className="bs-confirm">
                <button className="btn danger" onClick={() => bs.deleteMessage(m.id)}>
                  Delete message
                </button>
                <button className="btn ghost" onClick={() => setConfirm(null)}>
                  Keep it
                </button>
              </span>
            ) : (
              <button className="bs-link danger" onClick={() => setConfirm(m.id)}>
                Delete…
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
