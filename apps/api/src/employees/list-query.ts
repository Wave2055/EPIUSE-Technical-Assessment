import type { EmployeeListQuery, Role, SortDirection } from '@epiuse/shared';
import { ApiError } from '../common/errors/api-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { fromIsoDate } from './employee.mapper.js';

const SEARCH_FIELDS = ['firstName', 'lastName', 'email', 'employeeNumber', 'position'] as const;

/**
 * Prisma's `contains` becomes ILIKE without escaping, so `%` and `_` in a search would act
 * as wildcards and match everyone. Escape them, and the escape character itself.
 */
export const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface EmployeeListArgs {
  where: Prisma.EmployeeWhereInput;
  orderBy: Prisma.EmployeeOrderByWithRelationInput[];
  skip: number;
  take: number;
}

/**
 * Turns the validated table query into Prisma arguments. The shared schema has already
 * allowlisted the sort field; this adds the role rule: a VIEWER may not sort or filter on
 * salary, because the order alone would leak a value the API masks (ADR-0014).
 */
export function buildEmployeeListArgs(query: EmployeeListQuery, role: Role): EmployeeListArgs {
  const usesSalary =
    query.sort.field === 'salary' || query.salaryMin !== undefined || query.salaryMax !== undefined;
  if (role !== 'ADMIN' && usesSalary) {
    throw new ApiError(403, 'SALARY_HIDDEN', 'Salaries are hidden for your account.');
  }

  const and: Prisma.EmployeeWhereInput[] = [];

  // Every word must match some field, so "thandi nkosi" finds Thandi Nkosi.
  for (const term of query.q?.split(/\s+/).filter(Boolean) ?? []) {
    and.push({
      OR: SEARCH_FIELDS.map((field) => ({
        [field]: { contains: escapeLike(term), mode: 'insensitive' },
      })),
    });
  }
  if (query.position) and.push({ position: { equals: query.position, mode: 'insensitive' } });
  if (query.managerId) and.push({ managerId: query.managerId === 'none' ? null : query.managerId });
  if (query.birthDateFrom || query.birthDateTo) {
    and.push({
      birthDate: {
        ...(query.birthDateFrom && { gte: fromIsoDate(query.birthDateFrom) }),
        ...(query.birthDateTo && { lte: fromIsoDate(query.birthDateTo) }),
      },
    });
  }
  if (query.salaryMin !== undefined || query.salaryMax !== undefined) {
    and.push({
      salary: {
        ...(query.salaryMin !== undefined && { gte: query.salaryMin }),
        ...(query.salaryMax !== undefined && { lte: query.salaryMax }),
      },
    });
  }

  return {
    where: and.length > 0 ? { AND: and } : {},
    orderBy: orderBy(query.sort.field, query.sort.direction),
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

function orderBy(
  field: EmployeeListQuery['sort']['field'],
  dir: SortDirection,
): Prisma.EmployeeOrderByWithRelationInput[] {
  // Name then id as tie-breakers, so pagination is stable.
  const tail: Prisma.EmployeeOrderByWithRelationInput[] = [
    { lastName: 'asc' },
    { firstName: 'asc' },
    { id: 'asc' },
  ];
  switch (field) {
    case 'name':
      return [{ lastName: dir }, { firstName: dir }, { id: 'asc' }];
    case 'manager':
      return [{ manager: { lastName: dir } }, { manager: { firstName: dir } }, ...tail];
    default:
      return [{ [field]: dir }, ...tail];
  }
}
