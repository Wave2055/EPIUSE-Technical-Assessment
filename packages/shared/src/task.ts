import { z } from 'zod';

/**
 * Personal work items on the home screen. An additional feature beyond the brief
 * (ADR-0022): owners write their own tasks; managers can read their direct reports'.
 */
export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.uuid(),
  employeeId: z.uuid(),
  title: z.string(),
  status: TaskStatusSchema,
  dueDate: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Task = z.infer<typeof TaskSchema>;

const taskFields = {
  title: z.string().trim().min(1, 'Enter what needs doing.').max(200),
  status: TaskStatusSchema,
  dueDate: z.iso.date('Use the format YYYY-MM-DD.').nullable(),
};

export const CreateTaskSchema = z.object({
  title: taskFields.title,
  status: taskFields.status.default('todo'),
  dueDate: taskFields.dueDate.default(null),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z
  .object(taskFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to change.');
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const TaskScopeQuerySchema = z.object({
  /** `mine`: own tasks. `team`: own tasks, then each direct report's. */
  scope: z.enum(['mine', 'team']).default('mine'),
});
export type TaskScope = z.infer<typeof TaskScopeQuerySchema>['scope'];

export const TaskGroupSchema = z.object({
  employee: z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    position: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  isSelf: z.boolean(),
  tasks: z.array(TaskSchema),
});
export const TaskListResponseSchema = z.object({ groups: z.array(TaskGroupSchema) });
export type TaskGroup = z.infer<typeof TaskGroupSchema>;
export type TaskListResponse = z.infer<typeof TaskListResponseSchema>;
