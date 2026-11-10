"use client";

// One task, opened: every field editable with ordinary controls. Changes
// save as each field is left, so there is no Save button to forget.
import { useEffect, useRef, useState } from "react";
import { downloadIcs } from "./ics";
import {
  STATUSES,
  fromLocalInput,
  toLocalInput,
  type ListName,
  type Priority,
  type Project,
  type Status,
  type Task,
  type TaskPatch,
} from "./types";

export default function TaskDrawer({
  task,
  projects,
  onPatch,
  onDelete,
  onClose,
  say,
}: {
  task: Task;
  projects: Project[];
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  say: (msg: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
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
        className="bs-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        tabIndex={-1}
        ref={panel}
        key={task.id}
      >
        <div className="bs-drawer-head">
          <span className="quiet">
            Added {new Date(task.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {task.added_by !== "umit" ? ` by ${task.added_by}` : ""}
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
              value={task.list}
              onChange={(e) => patch({ list: e.target.value as ListName })}
            >
              <option value="personal">Personal</option>
              <option value="work">Work</option>
            </select>
          </div>
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
        </div>

        <p className="bs-hint">
          Reminders pop up here while Backstage is open. For an alert on your
          phone, add the task to your calendar.
        </p>

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
