import type { Task } from "../components/backstage/types";
import type { TaskFilters } from "../components/backstage/TaskToolbar";

export function visibleTasks(tasks: Task[], filters: TaskFilters, today: string): Task[] {
  const end = new Date(today + "T12:00:00"); end.setDate(end.getDate() + 7);
  const week = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const query = filters.search.trim().toLocaleLowerCase();
  const rank = { high: 0, normal: 1, low: 2 };
  return tasks.filter(t => (!query || `${t.title} ${t.notes || ""}`.toLocaleLowerCase().includes(query)) &&
    (filters.priority === "all" || t.priority === filters.priority) &&
    (filters.when === "all" || filters.when === "none" && !t.due_date || t.status !== "done" && !!t.due_date && (
      filters.when === "today" && t.due_date === today || filters.when === "overdue" && t.due_date < today || filters.when === "week" && t.due_date >= today && t.due_date <= week
    )))
    .sort((a, b) => filters.order === "due" ? (a.due_date || "9999").localeCompare(b.due_date || "9999") || a.position - b.position : filters.order === "priority" ? rank[a.priority] - rank[b.priority] || a.position - b.position : filters.order === "newest" ? b.created_at.localeCompare(a.created_at) : a.position - b.position || b.created_at.localeCompare(a.created_at));
}
