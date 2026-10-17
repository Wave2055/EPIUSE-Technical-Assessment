import { Handle, Position, type NodeProps } from '@xyflow/react';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { fullName } from '@/features/employees/format';
import { cn } from '@/lib/utils';
import { NODE_HEIGHT, NODE_WIDTH, type EmployeeNode } from './layout';

/** One person in the org chart. Top-level employees get the navy treatment. */
export function EmployeeNodeCard({ data, selected }: NodeProps<EmployeeNode>) {
  const { employee, reportCount } = data;
  const isRoot = employee.managerId === null;
  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 shadow-xs transition-shadow',
        isRoot
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card text-card-foreground',
        selected && 'ring-2 ring-brand ring-offset-2 ring-offset-background',
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      <EmployeeAvatar employee={employee} className="size-9" />
      <div className="grid min-w-0 flex-1 leading-tight">
        <span className={cn('truncate text-sm font-semibold', !isRoot && 'text-heading')}>
          {fullName(employee)}
        </span>
        <span className={cn('truncate text-xs', isRoot ? 'opacity-80' : 'text-muted-foreground')}>
          {employee.position}
        </span>
      </div>
      {reportCount > 0 && (
        <span
          title={`${reportCount} direct report${reportCount === 1 ? '' : 's'}`}
          className={cn(
            'rounded-full px-1.5 text-xs tabular-nums',
            isRoot ? 'bg-primary-foreground/15' : 'bg-secondary text-secondary-foreground',
          )}
        >
          {reportCount}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0"
        isConnectable={false}
      />
    </div>
  );
}
