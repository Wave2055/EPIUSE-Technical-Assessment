import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { fullName } from '@/features/employees/format';
import type { Employee, Task } from '@/features/employees/types';
import { errorMessage } from '@/lib/errors';
import { TaskList } from './task-list';

export type TaskView = 'mine' | 'team';

/**
 * "My tasks" is the person's own list. "Team tasks" appends each direct report's list under
 * it, so a manager sees what the whole team is working on in one place, and can give any of
 * them a new task (ADR-0032).
 */
export function TasksCard({
  self,
  reports,
  tasks,
  loading = false,
  view,
  onViewChange,
  onToggle,
  onAdd,
}: {
  self: Employee;
  reports: Employee[];
  tasks: Task[];
  loading?: boolean;
  view: TaskView;
  onViewChange: (view: TaskView) => void;
  onToggle?: (task: Task, done: boolean) => void;
  /** Adds to the signed-in person's list, or to a direct report's when `employeeId` is set. */
  onAdd: (title: string, employeeId?: string) => Promise<unknown>;
}) {
  const tasksFor = (id: string) => tasks.filter((t) => t.employeeId === id);
  const openCount = (id: string) => tasksFor(id).filter((t) => t.status !== 'done').length;
  const teamOpen = [self, ...reports].reduce((n, e) => n + openCount(e.id), 0);

  return (
    <Card className="gap-4">
      <Tabs value={view} onValueChange={(v) => onViewChange(v as TaskView)} className="gap-4">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <CardTitle className="text-heading">What you&apos;re working on</CardTitle>
            <CardDescription>
              {view === 'mine'
                ? 'Your own tasks. Tick one off when it is done.'
                : `Your tasks plus those of your ${reports.length} direct report${reports.length === 1 ? '' : 's'}. You can give any of them a task.`}
            </CardDescription>
          </div>
          <TabsList>
            <TabsTrigger value="mine">
              My tasks <Count n={openCount(self.id)} />
            </TabsTrigger>
            <TabsTrigger value="team" disabled={reports.length === 0}>
              Team tasks <Count n={teamOpen} />
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent>
          <TabsContent value="mine" className="grid gap-3">
            <AddTaskRow onAdd={(title) => onAdd(title)} />
            <TaskList
              tasks={tasksFor(self.id)}
              selfId={self.id}
              onToggle={onToggle}
              emptyMessage={loading ? 'Loading tasks…' : 'You have no tasks. Add one above.'}
            />
          </TabsContent>

          <TabsContent value="team" className="grid gap-5">
            <PersonSection employee={self} label="You">
              <TaskList tasks={tasksFor(self.id)} selfId={self.id} onToggle={onToggle} />
            </PersonSection>
            {reports.map((r) => (
              <PersonSection key={r.id} employee={r}>
                <AddTaskRow
                  onAdd={(title) => onAdd(title, r.id)}
                  placeholder={`Give ${r.firstName} a task`}
                  label={`New task for ${fullName(r)}`}
                />
                <TaskList
                  tasks={tasksFor(r.id)}
                  selfId={self.id}
                  readOnly
                  emptyMessage={`${r.firstName} has no tasks.`}
                />
              </PersonSection>
            ))}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

function PersonSection({
  employee,
  label,
  children,
}: {
  employee: Employee;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`tasks-${employee.id}`} className="grid scroll-mt-24 gap-1">
      <h3 className="flex items-center gap-2 border-b pb-2 text-sm">
        <EmployeeAvatar employee={employee} className="size-6" />
        <span className="font-semibold">{label ?? fullName(employee)}</span>
        <span className="truncate text-muted-foreground">{employee.position}</span>
      </h3>
      {children}
    </section>
  );
}

/** A new task, for the signed-in person or for one of their direct reports. */
function AddTaskRow({
  onAdd,
  placeholder = 'Add a task, e.g. Review Q4 budget',
  label = 'New task',
}: {
  onAdd: (title: string) => Promise<unknown>;
  placeholder?: string;
  label?: string;
}) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      setTitle('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex gap-2" onSubmit={(e) => void submit(e)}>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder={placeholder}
        aria-label={label}
      />
      <Button type="submit" variant="secondary" disabled={saving || !title.trim()}>
        <Plus /> Add
      </Button>
    </form>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">
      {n}
    </span>
  );
}
