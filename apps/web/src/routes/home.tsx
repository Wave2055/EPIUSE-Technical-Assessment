import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loading } from '@/components/loading';
import { QueryError } from '@/components/query-error';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/session';
import type { Employee } from '@/features/employees/types';
import { useCreateTask, useMe, useTeamTasks, useUpdateTask } from '@/features/home/api';
import { ProfileHeader } from '@/features/home/profile-header';
import { isOverdue } from '@/features/home/tasks';
import { TasksCard, type TaskView } from '@/features/home/tasks-card';
import { TeamList } from '@/features/home/team-list';
import { errorMessage } from '@/lib/errors';

/**
 * Home: the signed-in person, their direct reports, and what each of them is working on
 * (ADR-0022). A login with no employee record has no team or tasks, and is told so.
 */
export function HomeRoute() {
  const me = useMe();
  const tasks = useTeamTasks(Boolean(me.data?.employee));
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [view, setView] = useState<TaskView>('mine');

  if (me.isPending) return <Loading />;
  if (me.isError) return <QueryError error={me.error} onRetry={() => void me.refetch()} />;

  const { employee: self, manager, directReports: reports } = me.data;
  if (!self) return <NotLinked />;

  const allTasks = tasks.data?.groups.flatMap((group) => group.tasks) ?? [];
  const own = allTasks.filter((t) => t.employeeId === self.id);
  const openTaskCounts = Object.fromEntries(
    [self, ...reports].map((e) => [
      e.id,
      allTasks.filter((t) => t.employeeId === e.id && t.status !== 'done').length,
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

        {tasks.isError ? (
          <QueryError
            title="Your tasks could not be loaded"
            error={tasks.error}
            onRetry={() => void tasks.refetch()}
          />
        ) : (
          <TasksCard
            self={self}
            reports={reports}
            tasks={allTasks}
            loading={tasks.isPending}
            view={view}
            onViewChange={setView}
            onToggle={(task, done) =>
              updateTask.mutate(
                { id: task.id, changes: { status: done ? 'done' : 'todo' } },
                { onError: (error) => toast.error(errorMessage(error)) },
              )
            }
            onAdd={(title, employeeId) => createTask.mutateAsync({ title, employeeId })}
          />
        )}
      </div>
    </section>
  );
}

/** Logins need not belong to an employee (ADR-0022); everything else still works. */
function NotLinked() {
  const user = useCurrentUser();
  return (
    <section className="mx-auto grid max-w-2xl gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-heading">Welcome, {user.email}</CardTitle>
          <CardDescription>
            Your login is not linked to an employee record, so there is no team or task list to show
            here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 text-sm">
          <Link to="/hierarchy" className="text-heading underline underline-offset-2">
            Open the org chart
          </Link>
          <Link to="/employees" className="text-heading underline underline-offset-2">
            Browse employees
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
