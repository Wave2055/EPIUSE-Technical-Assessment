import { EmployeeListQuerySchema } from '@epiuse/shared';
import { ApiError } from '../common/errors/api-error.js';
import { buildEmployeeListArgs } from './list-query.js';

const query = (raw: Record<string, unknown> = {}) => EmployeeListQuerySchema.parse(raw);

describe('buildEmployeeListArgs', () => {
  it('pages with skip and take', () => {
    const args = buildEmployeeListArgs(query({ page: 3, pageSize: 20 }), 'ADMIN');
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
  });

  it('requires every search word to match some field', () => {
    const args = buildEmployeeListArgs(query({ q: 'thandi  nkosi' }), 'ADMIN');
    expect(args.where.AND).toHaveLength(2);
  });

  it('maps managerId "none" to a null manager', () => {
    const args = buildEmployeeListArgs(query({ managerId: 'none' }), 'VIEWER');
    expect(args.where.AND).toEqual([{ managerId: null }]);
  });

  it('sorts by manager name through the relation, with stable tie-breakers', () => {
    const args = buildEmployeeListArgs(query({ sort: 'manager:desc' }), 'ADMIN');
    expect(args.orderBy[0]).toEqual({ manager: { lastName: 'desc' } });
    expect(args.orderBy.at(-1)).toEqual({ id: 'asc' });
  });

  it('lets an admin sort and filter on salary', () => {
    expect(() =>
      buildEmployeeListArgs(query({ sort: 'salary:desc', salaryMin: 1 }), 'ADMIN'),
    ).not.toThrow();
  });

  it.each([{ sort: 'salary:asc' }, { salaryMin: 100 }, { salaryMax: 100 }])(
    'refuses salary ordering or filtering for a viewer: %o',
    (raw) => {
      const run = () => buildEmployeeListArgs(query(raw), 'VIEWER');
      expect(run).toThrow(ApiError);
      expect(run).toThrow(expect.objectContaining({ code: 'SALARY_HIDDEN', status: 403 }));
    },
  );
});
