import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { fullName } from '@/features/employees/format';
import type { Employee } from '@/features/employees/types';
import { cn } from '@/lib/utils';

/** The person themselves, then everyone who reports directly to them. */
export function TeamList({
  self,
  reports,
  openTaskCounts,
  onSelect,
}: {
  self: Employee;
  reports: Employee[];
  openTaskCounts: Record<string, number>;
  onSelect?: (employee: Employee) => void;
}) {
  return (
    <ul className="grid gap-1">
      <TeamRow
        employee={self}
        isSelf
        openTasks={openTaskCounts[self.id] ?? 0}
        onSelect={onSelect}
      />
      {reports.length > 0 && (
        <li aria-hidden className="mx-2 my-1 border-t">
          <span className="sr-only">Direct reports</span>
        </li>
      )}
      {reports.map((r) => (
        <TeamRow
          key={r.id}
          employee={r}
          openTasks={openTaskCounts[r.id] ?? 0}
          onSelect={onSelect}
        />
      ))}
      {reports.length === 0 && (
        <li className="px-2 py-3 text-sm text-muted-foreground">No one reports to you yet.</li>
      )}
    </ul>
  );
}

function TeamRow({
  employee,
  isSelf = false,
  openTasks,
  onSelect,
}: {
  employee: Employee;
  isSelf?: boolean;
  openTasks: number;
  onSelect?: (employee: Employee) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(employee)}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent',
          isSelf && 'bg-secondary',
        )}
      >
        <EmployeeAvatar employee={employee} className="size-9" />
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-heading">{fullName(employee)}</span>
            {isSelf && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                You
              </Badge>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">{employee.position}</span>
        </span>
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {openTasks} open
        </span>
        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  );
}
