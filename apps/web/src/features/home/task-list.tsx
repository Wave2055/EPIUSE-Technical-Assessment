import { CircleDot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDate, fullName } from '@/features/employees/format';
import type { Task } from '@/features/employees/types';
import { cn } from '@/lib/utils';
import { isOverdue, sortTasks } from './tasks';

/**
 * A person's tasks. `readOnly` is for viewing someone else's list: the status shows, but
 * only the owner ticks items off. Tasks a manager assigned say who from; `selfId` turns the
 * signed-in person's own name into "you".
 */
export function TaskList({
  tasks,
  selfId,
  readOnly = false,
  onToggle,
  emptyMessage = 'Nothing on the list.',
}: {
  tasks: Task[];
  selfId?: string;
  readOnly?: boolean;
  onToggle?: (task: Task, done: boolean) => void;
  emptyMessage?: string;
}) {
  if (tasks.length === 0) {
    return <p className="px-2 py-3 text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ul className="grid">
      {sortTasks(tasks).map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          selfId={selfId}
          readOnly={readOnly}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}

function TaskItem({
  task,
  selfId,
  readOnly,
  onToggle,
}: {
  task: Task;
  selfId?: string;
  readOnly: boolean;
  onToggle?: (task: Task, done: boolean) => void;
}) {
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const id = `task-${task.id}`;

  return (
    <li className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-accent/60">
      <Checkbox
        id={id}
        checked={done}
        disabled={readOnly}
        onCheckedChange={(checked) => onToggle?.(task, checked === true)}
        className="mt-0.5"
        aria-label={readOnly ? undefined : `Mark "${task.title}" as done`}
      />
      <label
        htmlFor={id}
        className={cn(
          'grid min-w-0 flex-1 gap-0.5 text-sm leading-snug',
          !readOnly && 'cursor-pointer',
        )}
      >
        <span className={cn(done && 'text-muted-foreground line-through')}>{task.title}</span>
        {task.dueDate && (
          <span
            className={cn(
              'text-xs tabular-nums',
              overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
            )}
          >
            {overdue ? 'Overdue · ' : done ? 'Was due ' : 'Due '}
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.assignedBy && (
          <span className="text-xs text-muted-foreground">
            From {task.assignedBy.id === selfId ? 'you' : fullName(task.assignedBy)}
          </span>
        )}
      </label>
      {task.status === 'in_progress' && (
        <Badge variant="secondary" className="gap-1 text-[11px]">
          <CircleDot className="size-3 text-brand" />
          In progress
        </Badge>
      )}
    </li>
  );
}
