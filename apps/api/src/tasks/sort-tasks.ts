import type { TaskStatus } from '@epiuse/shared';

const STATUS_ORDER: Record<TaskStatus, number> = { in_progress: 0, todo: 1, done: 2 };

/** In progress first, then to-do, then done; earliest due date first; undated last. */
export function compareTasks(
  a: { status: TaskStatus; dueDate: Date | null; createdAt: Date },
  b: { status: TaskStatus; dueDate: Date | null; createdAt: Date },
): number {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}
