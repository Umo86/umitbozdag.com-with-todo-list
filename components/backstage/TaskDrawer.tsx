"use client";

// One task, opened for editing. Changes save as each field is left; Save
// closes the sheet (saving whatever is still being typed) and Delete removes
// the task, with Undo offered for a few seconds.
import { useEffect, useRef, useState } from "react";
import { REPEAT_LABEL, REPEATS, type Repeat } from "@/lib/parse";
import { isApp } from "./native";
import { BinIcon } from "./TaskList";
import {
  STATUSES,
  allAreas,
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
  type Space,
  type Status,
  type Task,
  type TaskPatch,
} from "./types";

export default function TaskDrawer({
  space,
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
  space: Space; // on the Work side the joint and wedding lists aren't offered
  task: Task;
  projects: Project[];
  me: Me;
  users: Person[];
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  say: (msg: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const other = users.find((u) => u.id !== me.id);
  const iWrote = task.added_by === me.id;
  const panel = useRef<HTMLDivElement>(null);
  const patch = (p: TaskPatch) => onPatch(task.id, p);

  // The other person can change this task while it is open here. The boxes
  // you are not typing in follow along, and leaving a box only saves it if
  // you actually changed it (so their newer text is never overwritten by an
  // older copy sitting in your box).
  const titleBox = useRef<HTMLTextAreaElement>(null);
  const notesBox = useRef<HTMLTextAreaElement>(null);
  const atFocus = useRef<string | null>(null);
  useEffect(() => {
    const el = titleBox.current;
    if (el && document.activeElement !== el) el.value = task.title;
  }, [task.title]);
  useEffect(() => {
    const el = notesBox.current;
    if (el && document.activeElement !== el) el.value = task.notes ?? "";
  }, [task.notes]);

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
          <h2>Edit task</h2>
          <button className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="bs-byline">
          <span className="bs-dot" style={{ background: colorOf(task.added_by) }} />
          Added by {task.added_by === me.id ? "you" : nameOf(task.added_by)},{" "}
          {new Date(task.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>

        <label className="bs-donebox">
          <input type="checkbox" checked={task.status === "done"} onChange={(e) => patch({ status: e.target.checked ? "done" : "todo" })} />
          <span>{task.status === "done" ? "Done" : "Mark as done"}</span>
        </label>

        <label htmlFor="d-title">Task</label>
        <textarea
          id="d-title"
          ref={titleBox}
          rows={2}
          maxLength={500}
          defaultValue={task.title}
          onFocus={(e) => (atFocus.current = e.currentTarget.value)}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            const touched = e.currentTarget.value !== atFocus.current;
            if (touched && v && v !== task.title) patch({ title: v });
            else e.currentTarget.value = task.title;
          }}
        />

        <label htmlFor="d-notes">Notes</label>
        <textarea
          id="d-notes"
          ref={notesBox}
          rows={5}
          maxLength={4000}
          defaultValue={task.notes ?? ""}
          placeholder="Phone numbers, links, what was agreed…"
          onFocus={(e) => (atFocus.current = e.currentTarget.value)}
          onBlur={(e) => {
            const v = e.currentTarget.value;
            if (v !== atFocus.current && v !== (task.notes ?? "")) patch({ notes: v });
            else e.currentTarget.value = task.notes ?? "";
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
            <label htmlFor="d-status">Status</label>
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
              value={task.wedding ? "wedding" : task.owner === "joint" ? "joint" : task.list}
              onChange={(e) =>
                e.target.value === "wedding"
                  ? patch({ owner: "joint", wedding: true })
                  : e.target.value === "joint"
                    ? patch({ owner: "joint", wedding: false, assignee: task.assignee ?? "both" })
                    : patch({ owner: me.id, wedding: false, list: e.target.value as ListName })
              }
            >
              <option value="work">{space === "work" ? "Work" : "My work"}</option>
              <option value="personal">{space === "work" ? "Personal" : "My personal"}</option>
              {space === "personal" && <option value="joint">Joint</option>}
              {space === "personal" && <option value="wedding">💍 Wedding (joint)</option>}
            </select>
          </div>
          {task.wedding && (
            <div>
              <label htmlFor="d-area">Area</label>
              <select id="d-area" value={task.area_id ?? ""} onChange={(e) => patch({ area_id: e.target.value || null })}>
                <option value="">No area</option>
                {allAreas().map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji ? `${a.emoji} ` : ""}
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {task.owner === "joint" && (
            <div>
              <label htmlFor="d-for">For</label>
              <select
                id="d-for"
                value={task.assignee ?? (task.wedding ? "" : "both")}
                onChange={(e) => patch({ assignee: (e.target.value || null) as Assignee | null })}
              >
                {task.wedding && <option value="">No one yet</option>}
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
              {projects
                // projects from the task's own side (and the one it is in now, whichever side that is)
                .filter((p) => p.id === task.project_id || p.list === (task.owner === "joint" ? "personal" : task.list))
                .map((p) => (
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

        <div className="bs-drawer-foot bs-edit-foot">
          <button
            className="btn danger-o"
            onClick={() => {
              onDelete(task.id);
              onClose();
            }}
          >
            <BinIcon /> Delete
          </button>
          <button
            className="btn"
            onClick={() => {
              // leave the field being typed in, so it saves, then close
              (document.activeElement as HTMLElement | null)?.blur?.();
              say("Saved.");
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
