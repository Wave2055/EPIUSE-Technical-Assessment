import { parseIsoDate } from '@/features/employees/format';
import type { Task } from '@/features/employees/types';

const STATUS_ORDER = { in_progress: 0, todo: 1, done: 2 } as const;

/** In progress first, then to-do, then done; earliest due date first within each. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
  );
}

export function isOverdue(task: Task, today = new Date()): boolean {
  if (task.status === 'done' || !task.dueDate) return false;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return parseIsoDate(task.dueDate) < startOfToday;
}
