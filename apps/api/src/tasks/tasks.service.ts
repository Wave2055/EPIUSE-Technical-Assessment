import { Injectable } from '@nestjs/common';
import type {
  CreateTaskInput,
  Task,
  TaskGroup,
  TaskListResponse,
  TaskScope,
  UpdateTaskInput,
} from '@epiuse/shared';
import { AvatarService } from '../avatars/avatar.service.js';
import { ApiError, notFound } from '../common/errors/api-error.js';
import type { RequestUser } from '../common/request-user.js';
import { fromIsoDate, toIsoDate } from '../employees/employee.mapper.js';
import type { Task as TaskRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { compareTasks } from './sort-tasks.js';

const toDto = (row: TaskRow): Task => ({
  id: row.id,
  employeeId: row.employeeId,
  title: row.title,
  status: row.status,
  dueDate: row.dueDate ? toIsoDate(row.dueDate) : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Home-screen tasks (ADR-0022). A login sees its linked employee's tasks and, in the team
 * view, its direct reports' tasks read-only. Only the owner can change a task; another
 * person's task id answers 404 so its existence does not leak.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarService,
  ) {}

  async list(user: RequestUser, scope: TaskScope): Promise<TaskListResponse> {
    const selfId = await this.linkedEmployeeId(user);
    const select = {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      email: true,
      avatarKey: true,
    } as const;

    const self = await this.prisma.employee.findUniqueOrThrow({ where: { id: selfId }, select });
    const reports =
      scope === 'team'
        ? await this.prisma.employee.findMany({
            where: { managerId: selfId },
            select,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          })
        : [];
    const people = [self, ...reports];

    const rows = await this.prisma.task.findMany({
      where: { employeeId: { in: people.map((p) => p.id) } },
    });
    rows.sort(compareTasks);

    const groups: TaskGroup[] = people.map(({ email, avatarKey, ...person }) => ({
      employee: { ...person, avatarUrl: this.avatars.resolveUrl({ email, avatarKey }) },
      isSelf: person.id === selfId,
      tasks: rows.filter((t) => t.employeeId === person.id).map(toDto),
    }));
    return { groups };
  }

  async create(user: RequestUser, input: CreateTaskInput): Promise<Task> {
    const employeeId = await this.linkedEmployeeId(user);
    const row = await this.prisma.task.create({
      data: {
        employeeId,
        title: input.title,
        status: input.status,
        dueDate: input.dueDate ? fromIsoDate(input.dueDate) : null,
      },
    });
    return toDto(row);
  }

  async update(user: RequestUser, id: string, input: UpdateTaskInput): Promise<Task> {
    await this.ownTask(user, id);
    const row = await this.prisma.task.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? fromIsoDate(input.dueDate) : null,
        }),
      },
    });
    return toDto(row);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    await this.ownTask(user, id);
    await this.prisma.task.delete({ where: { id } });
  }

  private async ownTask(user: RequestUser, id: string) {
    const employeeId = await this.linkedEmployeeId(user);
    const task = await this.prisma.task.findFirst({
      where: { id, employeeId },
      select: { id: true },
    });
    if (!task) throw notFound('That task');
  }

  private async linkedEmployeeId(user: RequestUser): Promise<string> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { employeeId: true },
    });
    if (!row?.employeeId) {
      throw new ApiError(
        409,
        'NOT_LINKED',
        'Your login is not linked to an employee record, so there are no tasks to show.',
      );
    }
    return row.employeeId;
  }
}
