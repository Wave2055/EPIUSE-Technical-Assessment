import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Employee, Task } from '@/features/employees/types';
import { TasksCard } from './tasks-card';

const person = (n: number, firstName: string, managerId: string | null = null): Employee => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  employeeNumber: `E-000${n}`,
  firstName,
  lastName: 'Test',
  email: `${firstName.toLowerCase()}@example.com`,
  birthDate: '1990-01-01',
  salary: null,
  position: 'Developer',
  managerId,
  manager: null,
  directReportCount: 0,
  avatarUrl: null,
  hasUploadedAvatar: false,
});

const boss = person(1, 'Busi');
const report = person(2, 'Sipho', boss.id);

const task = (title: string, employeeId: string, assignedBy: Employee | null): Task => ({
  id: crypto.randomUUID(),
  employeeId,
  title,
  status: 'todo',
  dueDate: null,
  assignedBy: assignedBy && {
    id: assignedBy.id,
    firstName: assignedBy.firstName,
    lastName: assignedBy.lastName,
  },
  createdAt: '2026-10-20T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
});

function renderCard(props: Partial<Parameters<typeof TasksCard>[0]> = {}) {
  const onAdd = vi.fn().mockResolvedValue(undefined);
  render(
    <TasksCard
      self={boss}
      reports={[report]}
      tasks={[]}
      view="team"
      onViewChange={() => {}}
      onAdd={onAdd}
      {...props}
    />,
  );
  return { onAdd };
}

describe('TasksCard team view', () => {
  it("adds a task to a direct report's list", async () => {
    const { onAdd } = renderCard();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'New task for Sipho Test' }),
      'Update the runbook{Enter}',
    );

    expect(onAdd).toHaveBeenCalledWith('Update the runbook', report.id);
  });

  it('says who assigned a task, naming the signed-in manager as "you"', () => {
    renderCard({ tasks: [task('Update the runbook', report.id, boss)] });
    expect(screen.getByText('From you')).toBeVisible();
  });

  it('names the manager on the report’s own list', () => {
    render(
      <TasksCard
        self={report}
        reports={[]}
        tasks={[task('Update the runbook', report.id, boss)]}
        view="mine"
        onViewChange={() => {}}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText('From Busi Test')).toBeVisible();
  });
});
