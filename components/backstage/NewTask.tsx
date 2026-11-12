"use client";

// Add one task by hand: every field as an ordinary control, nothing guessed.
import { useEffect, useRef, useState } from "react";
import { REPEAT_LABEL, REPEATS, type Repeat } from "@/lib/parse";
import { allAreas, fromLocalInput, nameOf, type Assignee, type ListName, type Me, type Owner, type Person, FILE_MAX_MB, type Priority, type Project, type Space } from "./types";
import type { Backstage } from "./useBackstage";
import { ClipIcon, fileSize, KindBadge } from "./TaskFiles";

export default function NewTask({
  bs,
  me,
  users,
  space,
  projects,
  defaultProject,
  defaultOwner,
  defaultWedding,
  defaultArea,
  onClose,
  onSwitchToEvent,
}: {
  bs: Backstage;
  me: Me;
  users: Person[];
  space: Space; // the side you are on: on Work, a new task is simply a work task
  projects: Project[];
  defaultProject: string | null;
  defaultOwner: Owner;
  defaultWedding?: boolean; // opened from the Wedding section
  defaultArea?: string | null; // …with this area picked
  onClose: () => void;
  onSwitchToEvent?: () => void;
}) {
  const work = space === "work";
  const [wedding, setWedding] = useState(!work && !!defaultWedding);
  const [joint, setJoint] = useState(!work && (defaultOwner === "joint" || !!defaultWedding));
  const [list, setList] = useState<ListName>(space);
  // only projects from the same side as the task (joint to-dos sit on Personal)
  const options = projects.filter((p) => p.list === (joint ? "personal" : list));
  // joint to-dos are for both by default; a wedding to-do can be left with no one yet
  const [assignee, setAssignee] = useState<Assignee | null>(defaultWedding ? null : "both");
  const other = users.find((u) => u.id !== me.id);
  const [busy, setBusy] = useState(false);
  // files chosen here go up once the task exists
  const [picked, setPicked] = useState<File[]>([]);
  const [sending, setSending] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [more, setMore] = useState(!!defaultProject); // open when a project is already chosen
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
        className="bs-drawer bs-sheet"
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
            list: joint ? "personal" : list,
            owner: joint ? "joint" : me.id,
            assignee: joint ? assignee : null,
            wedding: joint && wedding,
            area_id: joint && wedding ? String(f.get("area") ?? "") || null : null,
            project_id: String(f.get("project") ?? "") || null,
            priority: (String(f.get("priority")) as Priority) || "normal",
            due_date: String(f.get("due") ?? "") || null,
            remind_at: fromLocalInput(String(f.get("remind") ?? "")),
            repeat: (String(f.get("repeat") ?? "") || null) as Repeat | null,
          });
          if (t) {
            let up = 0;
            for (let i = 0; i < picked.length; i++) {
              setSending(`Uploading ${i + 1} of ${picked.length}…`);
              if (await bs.uploadFile(t.id, picked[i], (pct) => setSending(`Uploading ${i + 1} of ${picked.length}… ${pct}%`))) up++;
            }
            setBusy(false);
            // (a file that didn't go up has already said why; the task is there, and it can be attached again)
            if (up === picked.length) bs.say(up ? `Task added, with ${up} file${up === 1 ? "" : "s"}.` : "Task added.");
            onClose();
          } else setBusy(false);
        }}
      >
        <div className="bs-grab" aria-hidden="true" />
        <div className="bs-drawer-head">
          <h2 id="nt-h">New task</h2>
          <button type="button" className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {onSwitchToEvent && (
          <div className="bs-seg wide" role="group" aria-label="Add">
            <button type="button" aria-pressed="true">
              Task
            </button>
            <button type="button" onClick={onSwitchToEvent}>
              Event
            </button>
          </div>
        )}
        <label htmlFor="nt-title">Task</label>
        <textarea
          id="nt-title"
          name="title"
          ref={title}
          rows={2}
          maxLength={500}
          required
          placeholder={work ? "e.g. Chase the signage quote" : "e.g. Book the dentist"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />

        {!work && <label>Whose</label>}
        <div className="bs-seg" role="group" aria-label="Whose list" hidden={work}>
          <button
            type="button"
            aria-pressed={!joint}
            onClick={() => {
              setJoint(false);
              setWedding(false);
            }}
          >
            Mine
          </button>
          <button
            type="button"
            aria-pressed={joint && !wedding}
            onClick={() => {
              setJoint(true);
              setWedding(false);
              setAssignee((a) => a ?? "both");
            }}
          >
            Joint
          </button>
          <button
            type="button"
            className="wed"
            aria-pressed={joint && wedding}
            onClick={() => {
              setJoint(true);
              setWedding(true);
            }}
          >
            💍 Wedding
          </button>
        </div>
        {joint && (
          <div className="bs-seg small" role="group" aria-label="Who it's for">
            {wedding && (
              <button type="button" aria-pressed={assignee === null} onClick={() => setAssignee(null)}>
                No one yet
              </button>
            )}
            {(["both", me.id, other?.id].filter(Boolean) as Assignee[]).map((a) => (
              <button type="button" key={a} aria-pressed={assignee === a} onClick={() => setAssignee(a)}>
                {a === "both" ? "Both of us" : a === me.id ? "Me" : nameOf(a)}
              </button>
            ))}
          </div>
        )}

        <div className="bs-fields">
          {joint && wedding && allAreas().length > 0 && (
            <div>
              <label htmlFor="nt-area">Area</label>
              <select id="nt-area" name="area" defaultValue={defaultArea ?? ""}>
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
          {!joint && !work && (
            <div>
              <label htmlFor="nt-list">List</label>
              <select id="nt-list" name="list" value={list} onChange={(e) => setList(e.target.value === "work" ? "work" : "personal")}>
                <option value="personal">Personal</option>
                <option value="work">Work</option>
              </select>
            </div>
          )}
          <div>
            <label htmlFor="nt-due">Due date</label>
            <input id="nt-due" name="due" type="date" />
          </div>
        </div>

        <div className="bs-files new">
          <div className="bs-files-head">
            <label>Files{picked.length ? ` (${picked.length})` : ""}</label>
            <button type="button" className="bs-attach" onClick={() => fileInput.current?.click()}>
              <ClipIcon /> Attach
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              aria-label="Attach files"
              onChange={(e) => {
                const add = [...(e.target.files ?? [])];
                const big = add.find((f) => f.size > FILE_MAX_MB * 1048576);
                if (big) bs.say(`${big.name} is ${Math.round(big.size / 1048576)} MB. The limit is ${FILE_MAX_MB} MB a file.`, "error");
                setPicked((p) => [...p, ...add.filter((f) => f.size && f.size <= FILE_MAX_MB * 1048576)].slice(0, 20));
                e.target.value = "";
              }}
            />
          </div>
          {picked.length > 0 && (
            <ul className="bs-filelist">
              {picked.map((f, i) => (
                <li key={`${f.name}:${i}`}>
                  <span className="open">
                    <KindBadge name={f.name} mime={f.type} />
                    <span className="nm">
                      <b>{f.name}</b>
                      <small>{fileSize(f.size)}</small>
                    </span>
                  </span>
                  <span className="acts">
                    <button type="button" aria-label={`Remove ${f.name}`} title="Remove" onClick={() => setPicked((p) => p.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="button" className="bs-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? "Fewer options" : "More options"} <span className="quiet">{more ? "" : "reminder, project, notes, repeat"}</span>
          <span aria-hidden="true">{more ? "▴" : "▾"}</span>
        </button>
        <div hidden={!more}>
          <div className="bs-fields">
            <div>
              <label htmlFor="nt-remind">Reminder</label>
              <input id="nt-remind" name="remind" type="datetime-local" />
            </div>
            <div>
              <label htmlFor="nt-project">Project</label>
              <select id="nt-project" name="project" defaultValue={defaultProject ?? ""}>
                <option value="">No project</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
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
          <label htmlFor="nt-notes">Notes</label>
          <textarea id="nt-notes" name="notes" rows={3} maxLength={4000} placeholder="Phone numbers, links, what was agreed…" />
        </div>

        <p className="error-line" role="alert">{err}</p>

        <div className="bs-drawer-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? sending || "Adding…" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}
