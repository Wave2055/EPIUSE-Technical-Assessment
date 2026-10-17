import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDirectReports } from '@/features/employees/hierarchy';
import type { Employee, Task } from '@/features/employees/types';
import { ProfileHeader } from '@/features/home/profile-header';
import { isOverdue } from '@/features/home/tasks';
import { TasksCard, type TaskView } from '@/features/home/tasks-card';
import { TeamList } from '@/features/home/team-list';
import { CURRENT_EMPLOYEE_ID, taskFixtures } from '@/mocks/fixtures';
import { useEmployees } from '@/mocks/store';

/**
 * Home: the signed-in person, their direct reports, and what each of them is working on.
 *
 * Design mock. The signed-in person and their tasks come from static fixtures; ticking a
 * task only changes local state until a tasks API exists.
 */
export function HomeRoute() {
  const employees = useEmployees();
  const self = employees.find((e) => e.id === CURRENT_EMPLOYEE_ID);
  const [view, setView] = useState<TaskView>('mine');
  const [done, setDone] = useState<Record<string, boolean>>({});

  const tasks = useMemo<Task[]>(
    () =>
      taskFixtures.map((t) => (t.id in done ? { ...t, status: done[t.id] ? 'done' : 'todo' } : t)),
    [done],
  );

  if (!self) return null;

  const manager = employees.find((e) => e.id === self.managerId);
  const reports = getDirectReports(employees, self.id);
  const own = tasks.filter((t) => t.employeeId === self.id);
  const openTaskCounts = Object.fromEntries(
    [self, ...reports].map((e) => [
      e.id,
      tasks.filter((t) => t.employeeId === e.id && t.status !== 'done').length,
    ]),
  );

  function showTeamMember(employee: Employee) {
    setView(employee.id === self!.id ? 'mine' : 'team');
    requestAnimationFrame(() =>
      document
        .getElementById(`tasks-${employee.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 p-6">
      <ProfileHeader
        employee={self}
        manager={manager}
        reportCount={reports.length}
        openTaskCount={own.filter((t) => t.status !== 'done').length}
        overdueCount={own.filter((t) => isOverdue(t)).length}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-heading">Your team</CardTitle>
            <CardDescription>
              You and the {reports.length} {reports.length === 1 ? 'person' : 'people'} who report
              to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <TeamList
              self={self}
              reports={reports}
              openTaskCounts={openTaskCounts}
              onSelect={showTeamMember}
            />
          </CardContent>
        </Card>

        <TasksCard
          self={self}
          reports={reports}
          tasks={tasks}
          view={view}
          onViewChange={setView}
          onToggle={(task, isDone) => setDone((d) => ({ ...d, [task.id]: isDone }))}
        />
      </div>
    </section>
  );
}
