"use client";

// One task, opened: every field editable with ordinary controls. Changes
// save as each field is left, so there is no Save button to forget.
import { useEffect, useRef, useState } from "react";
import { REPEAT_LABEL, REPEATS, type Repeat } from "@/lib/parse";
import { downloadIcs } from "./ics";
import { isApp } from "./native";
import {
  STATUSES,
  fromLocalInput,
  toLocalInput,
  colorOf,
  nameOf,
  type Assignee,
  type ListName,
  type Me,
  type Person,
  type Priority,
  type Project,
  type Status,
  type Task,
  type TaskPatch,
} from "./types";

export default function TaskDrawer({
  task,
  projects,
  me,
  users,
  onPatch,
  onDelete,
  onClose,
  say,
  onNudge,
}: {
  onNudge?: (id: string) => void;
  task: Task;
  projects: Project[];
  me: Me;
  users: Person[];
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  say: (msg: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const other = users.find((u) => u.id !== me.id);
  const iWrote = task.added_by === me.id;
  const panel = useRef<HTMLDivElement>(null);
  const patch = (p: TaskPatch) => onPatch(task.id, p);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="bs-drawer bs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        tabIndex={-1}
        ref={panel}
        key={task.id}
      >
        <div className="bs-grab" aria-hidden="true" />
        <div className="bs-drawer-head">
          <span className="bs-byline">
            <span className="bs-dot" style={{ background: colorOf(task.added_by) }} />
            Added by {task.added_by === me.id ? "you" : nameOf(task.added_by)},{" "}
            {new Date(task.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
          <button className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label htmlFor="d-title">Task</label>
        <textarea
          id="d-title"
          rows={2}
          maxLength={500}
          defaultValue={task.title}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v && v !== task.title) patch({ title: v });
            else e.currentTarget.value = task.title;
          }}
        />

        <label htmlFor="d-notes">Notes</label>
        <textarea
          id="d-notes"
          rows={5}
          maxLength={4000}
          defaultValue={task.notes ?? ""}
          placeholder="Phone numbers, links, what was agreed…"
          onBlur={(e) => {
            const v = e.currentTarget.value;
            if (v !== (task.notes ?? "")) patch({ notes: v });
          }}
        />

        {task.owner === "joint" && iWrote && (
          <>
            <label htmlFor="d-love">💌 Hidden note for {other?.name ?? "them"}</label>
            <textarea
              id="d-love"
              rows={2}
              maxLength={1000}
              defaultValue={task.love_note ?? ""}
              placeholder={`Only shows when ${other?.name ?? "they"} opens this to-do… “and come home early, I miss you”`}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (v !== (task.love_note ?? "")) patch({ love_note: v || null } as TaskPatch);
              }}
            />
          </>
        )}
        {task.owner === "joint" && !iWrote && task.love_note && (
          <div className={`bs-lovenote${revealed ? " open" : ""}`}>
            {revealed ? (
              <p>
                <span aria-hidden="true">💌 </span>
                {task.love_note}
                <small> — {nameOf(task.added_by)}</small>
              </p>
            ) : (
              <button onClick={() => setRevealed(true)}>💌 There&rsquo;s a note for you. Tap to open</button>
            )}
          </div>
        )}

        <div className="bs-fields">
          <div>
            <label htmlFor="d-status">Column</label>
            <select
              id="d-status"
              value={task.status}
              onChange={(e) => patch({ status: e.target.value as Status })}
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="d-list">List</label>
            <select
              id="d-list"
              value={task.owner === "joint" ? "joint" : task.list}
              onChange={(e) =>
                e.target.value === "joint"
                  ? patch({ owner: "joint", assignee: task.assignee ?? "both" })
                  : patch({ owner: me.id, list: e.target.value as ListName })
              }
            >
              <option value="work">My work</option>
              <option value="personal">My personal</option>
              <option value="joint">Joint</option>
            </select>
          </div>
          {task.owner === "joint" && (
            <div>
              <label htmlFor="d-for">For</label>
              <select
                id="d-for"
                value={task.assignee ?? "both"}
                onChange={(e) => patch({ assignee: e.target.value as Assignee })}
              >
                <option value="both">Both of us</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id === me.id ? `Me (${u.name})` : u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="d-project">Project</label>
            <select
              id="d-project"
              value={task.project_id ?? ""}
              onChange={(e) => patch({ project_id: e.target.value || null })}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="d-priority">Priority</label>
            <select
              id="d-priority"
              value={task.priority}
              onChange={(e) => patch({ priority: e.target.value as Priority })}
            >
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="d-due">Due date</label>
            <input
              id="d-due"
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => patch({ due_date: e.target.value || null })}
            />
          </div>
          <div>
            <label htmlFor="d-remind">Reminder</label>
            <input
              id="d-remind"
              type="datetime-local"
              defaultValue={toLocalInput(task.remind_at)}
              onBlur={(e) => {
                const iso = fromLocalInput(e.currentTarget.value);
                if (iso !== task.remind_at) patch({ remind_at: iso });
              }}
            />
          </div>
          <div>
            <label htmlFor="d-repeat">Repeat</label>
            <select
              id="d-repeat"
              value={task.repeat ?? ""}
              onChange={(e) => patch({ repeat: (e.target.value || null) as Repeat | null })}
            >
              <option value="">Doesn&rsquo;t repeat</option>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {REPEAT_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="bs-hint">
          {isApp()
            ? "Reminders go off on this phone even when the app is closed."
            : "Reminders pop up here while Backstage is open, and on your phone through the Backstage Android app."}
          {task.repeat ? " When you tick this off, the next one is added." : ""}
        </p>

        {task.owner === "joint" && task.status !== "done" && onNudge && (
          <button className="bs-nudge" onClick={() => onNudge(task.id)}>
            👉 Nudge {other?.name ?? "them"} about this
            {task.nudges > 0 && <span className="quiet"> · nudged {task.nudges}×</span>}
          </button>
        )}

        <div className="bs-drawer-foot">
          <button
            className="btn ghost"
            onClick={() => {
              if (!downloadIcs(task)) say("Set a due date or a reminder first.");
            }}
          >
            Add to calendar
          </button>
          {confirming ? (
            <span className="bs-confirm">
              <button
                className="btn danger"
                onClick={() => {
                  onDelete(task.id);
                  onClose();
                }}
              >
                Delete task
              </button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button className="bs-link danger" onClick={() => setConfirming(true)}>
              Delete…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
