"use client";

// The board: three columns for one list. Cards drag between columns and
// reorder within them (pointer, touch and keyboard); the drawer offers the
// same moves through ordinary form controls.
import { REPEAT_LABEL } from "@/lib/parse";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  STATUSES,
  fmtDay,
  fmtWhen,
  isOverdue,
  type Project,
  type Status,
  type Task,
  type TaskPatch,
} from "./types";

type Cols = Record<Status, string[]>;
const DONE_SHOWN = 25;

function buildCols(tasks: Task[]): Cols {
  const cols: Cols = { todo: [], doing: [], done: [] };
  [...tasks]
    .sort(
      (a, b) =>
        a.position - b.position || b.created_at.localeCompare(a.created_at)
    )
    .forEach((t) => cols[t.status].push(t.id));
  return cols;
}

export default function Board({
  tasks,
  projects,
  canEdit,
  onAdd,
  onPatch,
  onOpen,
}: {
  tasks: Task[]; // already filtered to the list (and project) on show
  projects: Project[];
  canEdit: boolean;
  onAdd: (title: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  onOpen: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectOf = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const [cols, setCols] = useState<Cols>(() => buildCols(tasks));
  const [dragging, setDragging] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const startCol = useRef<Status | null>(null);

  // Follow the data except mid-drag, when the local order is the truth.
  useEffect(() => {
    if (!dragging) setCols(buildCols(tasks));
  }, [tasks, dragging]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const colOf = (id: string): Status | null => {
    if (id.startsWith("col:")) return id.slice(4) as Status;
    return (Object.keys(cols) as Status[]).find((s) => cols[s].includes(id)) ?? null;
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragging(id);
    startCol.current = colOf(id);
  };

  const onDragOver = (e: DragOverEvent) => {
    if (!e.over) return;
    const id = String(e.active.id);
    const overId = String(e.over.id);
    const from = colOf(id);
    const to = colOf(overId);
    if (!from || !to || from === to) return;
    setCols((prev) => {
      const at = overId.startsWith("col:") ? prev[to].length : prev[to].indexOf(overId);
      const next = { ...prev, [from]: prev[from].filter((x) => x !== id) };
      const target = [...prev[to]];
      target.splice(at < 0 ? target.length : at, 0, id);
      next[to] = target;
      return next;
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    setDragging(null);
    const col = colOf(id);
    if (!col || !e.over) return setCols(buildCols(tasks));
    const overId = String(e.over.id);
    let order = cols[col];
    if (!overId.startsWith("col:") && overId !== id && order.includes(overId)) {
      order = arrayMove(order, order.indexOf(id), order.indexOf(overId));
    }
    setCols((prev) => ({ ...prev, [col]: order }));

    const i = order.indexOf(id);
    const before = i > 0 ? byId.get(order[i - 1])?.position : undefined;
    const after = i < order.length - 1 ? byId.get(order[i + 1])?.position : undefined;
    const moved = startCol.current !== col;

    // No room between the neighbours (equal positions): renumber the column.
    if (before !== undefined && after !== undefined && !(before < after)) {
      order.forEach((tid, n) => {
        const t = byId.get(tid);
        if (!t) return;
        if (tid === id) onPatch(tid, { position: n, ...(moved ? { status: col } : {}) });
        else if (t.position !== n) onPatch(tid, { position: n });
      });
      return;
    }
    const position =
      before !== undefined && after !== undefined
        ? (before + after) / 2
        : before !== undefined
        ? before + 1
        : after !== undefined
        ? after - 1
        : 0;
    const t = byId.get(id);
    if (!t || (!moved && t.position === position)) return;
    onPatch(id, { position, ...(moved ? { status: col } : {}) });
  };

  const active = dragging ? byId.get(dragging) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setCols(buildCols(tasks));
      }}
    >
      <div className="bs-board">
        {STATUSES.map(({ id: status, label }) => {
          const ids = cols[status].filter((id) => byId.has(id));
          const shown =
            status === "done" && !allDone ? ids.slice(0, DONE_SHOWN) : ids;
          return (
            <Column key={status} status={status} label={label} count={ids.length}>
              {status === "todo" && <QuickAdd onAdd={onAdd} />}
              <SortableContext items={shown} strategy={verticalListSortingStrategy}>
                {shown.map((id) => (
                  <SortableCard
                    key={id}
                    task={byId.get(id)!}
                    project={projectOf.get(byId.get(id)!.project_id ?? "")}
                    canEdit={canEdit}
                    onOpen={onOpen}
                    onPatch={onPatch}
                  />
                ))}
              </SortableContext>
              {ids.length === 0 && status !== "todo" && (
                <p className="bs-col-empty">
                  {status === "doing" ? "Nothing in progress." : "Nothing finished yet."}
                </p>
              )}
              {status === "done" && ids.length > DONE_SHOWN && (
                <button className="bs-more" onClick={() => setAllDone((v) => !v)}>
                  {allDone ? "Show fewer" : `Show all ${ids.length}`}
                </button>
              )}
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {active ? (
          <Card task={active} project={projectOf.get(active.project_id ?? "")} lifted />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  count,
  children,
}: {
  status: Status;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <section className={`bs-col${isOver ? " over" : ""}`} aria-label={label}>
      <h2>
        {label} <span className="n">{count}</span>
      </h2>
      <div className="bs-col-body" ref={setNodeRef}>
        {children}
      </div>
    </section>
  );
}

function QuickAdd({ onAdd }: { onAdd: (title: string) => void }) {
  return (
    <form
      className="bs-quick"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("title") as HTMLInputElement;
        const title = input.value.trim();
        if (!title) return;
        onAdd(title);
        input.value = "";
      }}
    >
      <input name="title" placeholder="Add a task and press Enter" maxLength={500} aria-label="New task" />
    </form>
  );
}

function SortableCard({
  task,
  project,
  canEdit,
  onOpen,
  onPatch,
}: {
  task: Task;
  project?: Project;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !canEdit });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "bs-slot" : undefined}
      {...attributes}
      {...listeners}
    >
      <Card
        task={task}
        project={project}
        onOpen={canEdit ? onOpen : undefined}
        onToggle={
          canEdit
            ? () => onPatch(task.id, { status: task.status === "done" ? "todo" : "done" })
            : undefined
        }
      />
    </div>
  );
}

function Card({
  task: t,
  project,
  lifted,
  onOpen,
  onToggle,
}: {
  task: Task;
  project?: Project;
  lifted?: boolean;
  onOpen?: (id: string) => void;
  onToggle?: () => void;
}) {
  const done = t.status === "done";
  const reminderDue = !!t.remind_at && !done && new Date(t.remind_at) <= new Date();
  return (
    <article className={`bs-cardlet${done ? " done" : ""}${lifted ? " lifted" : ""}`}>
      {onToggle && (
        <input
          type="checkbox"
          checked={done}
          onChange={onToggle}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
        />
      )}
      <div className="body">
        {onOpen ? (
          <button
            className="title"
            onClick={() => onOpen(t.id)}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {t.title}
          </button>
        ) : (
          <p className="title">{t.title}</p>
        )}
        {(project || t.due_date || t.remind_at || t.repeat || t.priority !== "normal" || t.added_by !== "umit" || t.notes) && (
          <div className="meta">
            {project && (
              <span className="proj">
                <span className="bs-dot" style={{ background: project.color }} />
                {project.name}
              </span>
            )}
            {t.due_date && (
              <span className={!done && isOverdue(t.due_date) ? "late" : undefined}>
                Due {fmtDay(t.due_date)}
              </span>
            )}
            {t.remind_at && (
              <span className={reminderDue ? "late" : undefined}>
                Reminder {fmtWhen(t.remind_at)}
              </span>
            )}
            {t.repeat && <span>↻ {REPEAT_LABEL[t.repeat]}</span>}
            {t.priority === "high" && <span className="high">High</span>}
            {t.priority === "low" && <span>Low priority</span>}
            {t.notes && <span>Has notes</span>}
            {t.added_by !== "umit" && <span>Added by {t.added_by}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
