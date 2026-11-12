"use client";

// Projects: add, rename, recolour, set a deadline, delete. Every project is a
// Work one or a Personal one, and shows on that side only. Deleting a project
// keeps its tasks; they only lose the label.
import { useState } from "react";
import { SWATCHES, type ListName, type Project, type Space } from "./types";
import type { Backstage } from "./useBackstage";

export default function Projects({
  bs,
  space,
  projects,
  onClose,
}: {
  bs: Backstage;
  space: Space; // the side you are on: its projects are listed, and a new one starts here
  projects: Project[];
  onClose: () => void;
}) {
  const [color, setColor] = useState(SWATCHES[0]);
  const [kind, setKind] = useState<ListName>(space);
  const here = projects.filter((p) => p.list === space);
  const word = space === "work" ? "Work" : "Personal";
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="bs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bs-drawer bs-sheet" role="dialog" aria-modal="true" aria-label={`${word} projects`}>
        <div className="bs-grab" aria-hidden="true" />
        <div className="bs-drawer-head">
          <h2>{word} projects</h2>
          <button className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <ul className="bs-projlist">
          {here.map((p) => (
            <li key={p.id} className={p.owner === "joint" ? "joint" : undefined}>
              <span className="bs-swatches small">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="bs-swatch"
                    style={{ background: c }}
                    aria-pressed={p.color.toLowerCase() === c}
                    aria-label={`Colour ${c} for ${p.name}`}
                    onClick={() => bs.patchProject(p.id, { color: c })}
                  />
                ))}
              </span>
              <input
                defaultValue={p.name}
                maxLength={120}
                aria-label={`Name of ${p.name}`}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (v && v !== p.name) bs.patchProject(p.id, { name: v });
                  else e.currentTarget.value = p.name;
                }}
              />
              <span className="bs-projsel">
                <select
                  className="bs-owner"
                  value={p.list}
                  aria-label={`Is ${p.name} work or personal`}
                  onChange={(e) => {
                    const to: ListName = e.target.value === "work" ? "work" : "personal";
                    bs.patchProject(p.id, { list: to });
                    bs.say(`${p.name} and its tasks moved to ${to === "work" ? "Work" : "Personal"}.`);
                  }}
                >
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                </select>
                {space === "personal" && (
                  <select
                    className="bs-owner"
                    value={p.owner === "joint" ? "joint" : "mine"}
                    aria-label={`Whose project is ${p.name}`}
                    onChange={(e) => bs.patchProject(p.id, { owner: e.target.value === "joint" ? "joint" : (bs.me?.id ?? "umit") })}
                  >
                    <option value="mine">Mine</option>
                    <option value="joint">Joint</option>
                  </select>
                )}
              </span>
              <span className="bs-deadline">
                <span>Deadline</span>
                <input
                  type="date"
                  value={p.due_date ?? ""}
                  aria-label={`Deadline for ${p.name}`}
                  onChange={(e) => bs.patchProject(p.id, { due_date: e.target.value || null })}
                />
              </span>
              {confirm === p.id ? (
                <span className="bs-confirm">
                  <button className="btn danger" onClick={() => bs.deleteProject(p.id)}>
                    Delete
                  </button>
                  <button className="btn ghost" onClick={() => setConfirm(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button className="bs-link danger" onClick={() => setConfirm(p.id)}>
                  Delete…
                </button>
              )}
            </li>
          ))}
        </ul>
        {!here.length && <p className="bs-empty small">No {word.toLowerCase()} projects yet. Add the first one below.</p>}
        <p className="bs-hint">
          Changing a project to {space === "work" ? "Personal" : "Work"} moves it, and its tasks, to the {space === "work" ? "Personal" : "Work"} side. Deleting a
          project keeps its tasks; they lose the label.
        </p>

        <form
          className="bs-newproj"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("pname") as HTMLInputElement;
            const name = input.value.trim();
            if (!name) return;
            const due = e.currentTarget.elements.namedItem("pdue") as HTMLInputElement;
            const own = e.currentTarget.elements.namedItem("powner") as HTMLSelectElement | null;
            void bs.addProject(name, color, due.value || null, own?.value === "joint" ? "joint" : null, kind);
            if (kind !== space) bs.say(`${name} added to ${kind === "work" ? "Work" : "Personal"}.`);
            input.value = "";
            due.value = "";
          }}
        >
          <label htmlFor="p-new">New project</label>
          <input id="p-new" name="pname" maxLength={120} placeholder={space === "work" ? "Project name, e.g. UKCW London 2027" : "Project name, e.g. Flat move"} />
          <label>Work or personal</label>
          <div className="bs-seg" role="group" aria-label="Work or personal">
            <button type="button" aria-pressed={kind === "work"} onClick={() => setKind("work")}>
              Work
            </button>
            <button type="button" aria-pressed={kind === "personal"} onClick={() => setKind("personal")}>
              Personal
            </button>
          </div>
          {space === "personal" && (
            <>
              <label htmlFor="p-owner">Whose</label>
              <select id="p-owner" name="powner" defaultValue="mine">
                <option value="mine">Mine (only I see it)</option>
                <option value="joint">Joint (we both see it)</option>
              </select>
            </>
          )}
          <label htmlFor="p-due">Deadline (optional)</label>
          <input id="p-due" name="pdue" type="date" />
          <div className="bs-swatches">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className="bs-swatch"
                style={{ background: c }}
                aria-pressed={color === c}
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="btn" type="submit">
            Add project
          </button>
        </form>
      </div>
    </div>
  );
}
