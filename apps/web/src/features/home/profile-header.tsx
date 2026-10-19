import { Link } from 'react-router-dom';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { fullName } from '@/features/employees/format';
import type { Employee, EmployeeRef } from '@/features/employees/types';

/** Who the signed-in person is, where they sit, and a glance at their workload. */
export function ProfileHeader({
  employee,
  manager,
  reportCount,
  openTaskCount,
  overdueCount,
}: {
  employee: Employee;
  manager: EmployeeRef | null;
  reportCount: number;
  openTaskCount: number;
  overdueCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border bg-card p-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <EmployeeAvatar employee={employee} className="size-16 text-lg" />
        <div className="grid min-w-0 gap-0.5">
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{fullName(employee)}</h1>
          <p className="text-sm">
            <span className="font-medium">{employee.position}</span>
            <span className="text-muted-foreground">
              {' · '}
              <span className="font-mono text-xs">{employee.employeeNumber}</span>
              {' · '}
              {manager ? (
                <>
                  Reports to{' '}
                  <Link to="/hierarchy" className="text-heading underline-offset-2 hover:underline">
                    {fullName(manager)}
                  </Link>
                </>
              ) : (
                'Top of the organisation'
              )}
            </span>
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-secondary/50">
        <Stat label="Direct reports" value={reportCount} />
        <Stat label="Open tasks" value={openTaskCount} />
        <Stat label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'alert' : undefined} />
      </dl>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'alert' }) {
  return (
    <div className="grid gap-0.5 px-5 py-3 text-center">
      <dd
        className={
          tone === 'alert'
            ? 'text-2xl font-semibold text-destructive tabular-nums'
            : 'text-2xl font-semibold text-heading tabular-nums'
        }
      >
        {value}
      </dd>
      <dt className="text-xs whitespace-nowrap text-muted-foreground">{label}</dt>
    </div>
  );
}
