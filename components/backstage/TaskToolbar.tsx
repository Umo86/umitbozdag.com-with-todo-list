"use client";

export type TaskFilters = { search: string; when: string; priority: string; order: string };
export const DEFAULT_FILTERS: TaskFilters = { search: "", when: "all", priority: "all", order: "manual" };

export default function TaskToolbar({ value, onChange, layout, onLayout, count }: { value: TaskFilters; onChange: (value: TaskFilters) => void; layout: "list" | "board"; onLayout: (layout: "list" | "board") => void; count: number }) {
  const update = (patch: Partial<TaskFilters>) => onChange({ ...value, ...patch });
  const active = value.search || value.when !== "all" || value.priority !== "all";
  return <div className="bs-task-toolbar">
    <input type="search" placeholder="Find a task…" aria-label="Search tasks and notes" value={value.search} onChange={e => update({ search: e.target.value })} />
    <select aria-label="Filter by due date" value={value.when} onChange={e => update({ when: e.target.value })}><option value="all">Any date</option><option value="today">Due today</option><option value="overdue">Overdue</option><option value="week">Next 7 days</option><option value="none">No date</option></select>
    <select aria-label="Filter by priority" value={value.priority} onChange={e => update({ priority: e.target.value })}><option value="all">Any priority</option><option value="high">High priority</option><option value="normal">Normal priority</option><option value="low">Low priority</option></select>
    <select aria-label="Sort tasks" disabled={layout === "board"} value={value.order} onChange={e => update({ order: e.target.value })}><option value="manual">Manual order</option><option value="due">Due date</option><option value="priority">Priority</option><option value="newest">Newest first</option></select>
    <div className="bs-seg small" role="group" aria-label="Task layout"><button aria-pressed={layout === "list"} onClick={() => onLayout("list")}>List</button><button aria-pressed={layout === "board"} onClick={() => onLayout("board")}>Board</button></div>
    {active && <button className="bs-link" onClick={() => onChange(DEFAULT_FILTERS)}>Clear filters</button>}
    <span className="bs-result-count" aria-live="polite">{count} {count === 1 ? "task" : "tasks"}</span>
  </div>;
}
