"use client";

// Add one task by hand: every field as an ordinary control, nothing guessed.
import { useEffect, useRef, useState } from "react";
import { REPEAT_LABEL, REPEATS, type Repeat } from "@/lib/parse";
import { fromLocalInput, type ListName, type Priority, type Project } from "./types";
import type { Backstage } from "./useBackstage";

export default function NewTask({
  bs,
  projects,
  defaultList,
  defaultProject,
  onClose,
}: {
  bs: Backstage;
  projects: Project[];
  defaultList: ListName;
  defaultProject: string | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const title = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    title.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="bs-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nt-h"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const name = String(f.get("title") ?? "").trim();
          if (!name) return setErr("Give the task a name.");
          setBusy(true);
          const t = await bs.addTask({
            title: name,
            notes: String(f.get("notes") ?? "").trim() || null,
            list: f.get("list") === "personal" ? "personal" : "work",
            project_id: String(f.get("project") ?? "") || null,
            priority: (String(f.get("priority")) as Priority) || "normal",
            due_date: String(f.get("due") ?? "") || null,
            remind_at: fromLocalInput(String(f.get("remind") ?? "")),
            repeat: (String(f.get("repeat") ?? "") || null) as Repeat | null,
          });
          setBusy(false);
          if (t) {
            bs.say("Task added.");
            onClose();
          }
        }}
      >
        <div className="bs-drawer-head">
          <h2 id="nt-h">New task</h2>
          <button type="button" className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label htmlFor="nt-title">Task</label>
        <textarea
          id="nt-title"
          name="title"
          ref={title}
          rows={2}
          maxLength={500}
          required
          placeholder="e.g. Chase the signage quote"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />

        <label htmlFor="nt-notes">Notes</label>
        <textarea id="nt-notes" name="notes" rows={3} maxLength={4000} placeholder="Phone numbers, links, what was agreed…" />

        <div className="bs-fields">
          <div>
            <label htmlFor="nt-list">List</label>
            <select id="nt-list" name="list" defaultValue={defaultList}>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
            </select>
          </div>
          <div>
            <label htmlFor="nt-project">Project</label>
            <select id="nt-project" name="project" defaultValue={defaultProject ?? ""}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nt-due">Due date</label>
            <input id="nt-due" name="due" type="date" />
          </div>
          <div>
            <label htmlFor="nt-remind">Reminder</label>
            <input id="nt-remind" name="remind" type="datetime-local" />
          </div>
          <div>
            <label htmlFor="nt-priority">Priority</label>
            <select id="nt-priority" name="priority" defaultValue="normal">
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="nt-repeat">Repeat</label>
            <select id="nt-repeat" name="repeat" defaultValue="">
              <option value="">Doesn&rsquo;t repeat</option>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {REPEAT_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="error-line" role="alert">{err}</p>

        <div className="bs-drawer-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Adding…" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}
