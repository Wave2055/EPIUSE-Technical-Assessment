import { describe, expect, it } from 'vitest';
import { CreateEmployeeSchema } from './employee.js';
import { DeleteEmployeeQuerySchema, EmployeeListQuerySchema } from './employee-query.js';

describe('EmployeeListQuerySchema', () => {
  it('defaults to name ascending, page 1', () => {
    const query = EmployeeListQuerySchema.parse({});
    expect(query.sort).toEqual({ field: 'name', direction: 'asc' });
    expect(query.page).toBe(1);
  });

  it('parses an allowlisted sort', () => {
    expect(EmployeeListQuerySchema.parse({ sort: 'salary:desc' }).sort).toEqual({
      field: 'salary',
      direction: 'desc',
    });
  });

  it.each(['password:asc', 'name:up', 'name', 'manager_id:asc'])('rejects sort %s', (sort) => {
    expect(EmployeeListQuerySchema.safeParse({ sort }).success).toBe(false);
  });

  it('accepts managerId "none" for employees with no manager', () => {
    expect(EmployeeListQuerySchema.parse({ managerId: 'none' }).managerId).toBe('none');
  });
});

describe('DeleteEmployeeQuerySchema', () => {
  it('defaults to promote', () => {
    expect(DeleteEmployeeQuerySchema.parse({}).strategy).toBe('promote');
  });

  it('requires reassignTo when reassigning', () => {
    const result = DeleteEmployeeQuerySchema.safeParse({ strategy: 'reassign' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['reassignTo']);
  });
});

describe('CreateEmployeeSchema', () => {
  const valid = {
    firstName: 'Thandi',
    lastName: 'Nkosi',
    employeeNumber: 'E-0001',
    email: ' Thandi.Nkosi@Example.com ',
    birthDate: '1971-03-14',
    salary: 3_250_000,
    position: 'Chief Executive Officer',
    managerId: null,
  };

  it('normalises the email', () => {
    expect(CreateEmployeeSchema.parse(valid).email).toBe('thandi.nkosi@example.com');
  });

  it('rejects a future birth date', () => {
    expect(CreateEmployeeSchema.safeParse({ ...valid, birthDate: '2999-01-01' }).success).toBe(
      false,
    );
  });

  it('rejects a malformed employee number', () => {
    expect(CreateEmployeeSchema.safeParse({ ...valid, employeeNumber: '0001' }).success).toBe(
      false,
    );
  });
});
