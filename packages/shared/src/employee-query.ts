import { z } from 'zod';
import { PageQuerySchema } from './pagination.js';

/** The only fields the reporting table may sort on. Anything else is a 400. */
export const EMPLOYEE_SORT_FIELDS = [
  'name',
  'firstName',
  'lastName',
  'employeeNumber',
  'email',
  'birthDate',
  'salary',
  'position',
  'manager',
] as const;
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

const SortSchema = z
  .string()
  .default('name:asc')
  .transform((value, ctx) => {
    const [field, direction] = value.split(':');
    if (
      !EMPLOYEE_SORT_FIELDS.includes(field as EmployeeSortField) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `Sort must be field:asc or field:desc, where field is one of ${EMPLOYEE_SORT_FIELDS.join(', ')}.`,
      });
      return z.NEVER;
    }
    return { field: field as EmployeeSortField, direction: direction as SortDirection };
  });

/** Query string for `GET /employees`: search, sort and filter on any employee field. */
export const EmployeeListQuerySchema = PageQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  sort: SortSchema,
  position: z.string().trim().max(120).optional(),
  /** A manager's id, or `none` for employees with no manager. */
  managerId: z.union([z.uuid(), z.literal('none')]).optional(),
  birthDateFrom: z.iso.date().optional(),
  birthDateTo: z.iso.date().optional(),
  salaryMin: z.coerce.number().nonnegative().optional(),
  salaryMax: z.coerce.number().nonnegative().optional(),
});
export type EmployeeListQuery = z.infer<typeof EmployeeListQuerySchema>;

/** Query string for `DELETE /employees/:id` (ADR-0010). */
export const DeleteEmployeeQuerySchema = z
  .object({
    strategy: z.enum(['promote', 'reassign']).default('promote'),
    reassignTo: z.uuid().optional(),
  })
  .refine((v) => v.strategy !== 'reassign' || v.reassignTo !== undefined, {
    message: 'Choose who the direct reports move to.',
    path: ['reassignTo'],
  });
export type DeleteEmployeeQuery = z.infer<typeof DeleteEmployeeQuerySchema>;
export type DeleteStrategyName = DeleteEmployeeQuery['strategy'];
