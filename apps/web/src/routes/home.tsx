import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loading } from '@/components/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/use-session';
import type { Employee, Me } from '@/features/employees/types';
import { useCreateTask, useMe, useTasks, useUpdateTask } from '@/features/home/api';
import { ProfileHeader } from '@/features/home/profile-header';
import { isOverdue } from '@/features/home/tasks';
import { TasksCard, type TaskView } from '@/features/home/tasks-card';
import { TeamList } from '@/features/home/team-list';
import { errorMessage } from '@/lib/api-errors';

/**
 * Home: the signed-in person, their direct reports, and what each of them is working on
 * (ADR-0022). A login with no linked employee record sees a short explanation instead.
 */
export function HomeRoute() {
  const me = useMe();

  if (me.isPending) return <Loading />;
  if (me.isError) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(me.error)}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!me.data.employee) return <NotLinked />;
  return <LinkedHome me={me.data} self={me.data.employee} />;
}

function LinkedHome({ me, self }: { me: Me; self: Employee }) {
  const [view, setView] = useState<TaskView>('mine');
  // One request covers both tabs: the team scope includes the person's own tasks.
  const taskList = useTasks('team');
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const reports = me.directReports;
  const tasks = taskList.data?.groups.flatMap((g) => g.tasks) ?? [];
  const own = tasks.filter((t) => t.employeeId === self.id);
  const openTaskCounts = Object.fromEntries(
    (taskList.data?.groups ?? []).map((g) => [
      g.employee.id,
      g.tasks.filter((t) => t.status !== 'done').length,
    ]),
  );

  function showTeamMember(employee: Employee) {
    setView(employee.id === self.id ? 'mine' : 'team');
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
        manager={me.manager}
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

        {taskList.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(taskList.error)}</AlertDescription>
          </Alert>
        ) : (
          <TasksCard
            self={self}
            reports={reports}
            tasks={tasks}
            view={view}
            onViewChange={setView}
            onToggle={(task, done) =>
              updateTask.mutate(
                { id: task.id, input: { status: done ? 'done' : 'todo' } },
                { onError: (error) => toast.error(errorMessage(error)) },
              )
            }
            onAdd={async (title) => {
              try {
                await createTask.mutateAsync({ title, status: 'todo', dueDate: null });
              } catch (error) {
                toast.error(errorMessage(error));
                throw error;
              }
            }}
          />
        )}
      </div>
    </section>
  );
}

/** Logins are separate from employees (ADR-0014); this one has no employee record. */
function NotLinked() {
  const user = useCurrentUser();
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-3 p-12 text-center">
      <UserRound className="size-8 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Welcome, {user.email}</h1>
      <p className="text-sm text-muted-foreground">
        Your login is not linked to an employee record, so there is no personal profile or task list
        to show. You can still browse the organisation.
      </p>
      <Button asChild variant="outline">
        <Link to="/hierarchy">Open the org chart</Link>
      </Button>
    </section>
  );
}
