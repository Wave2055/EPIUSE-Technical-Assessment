import type { Employee, Task } from '@/features/employees/types';

let next = 0;

/** A complete employee for component and helper tests; override what the test is about. */
export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  next += 1;
  return {
    id: `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`,
    employeeNumber: `E-${String(next).padStart(4, '0')}`,
    firstName: 'Test',
    lastName: `Person${next}`,
    email: `person${next}@example.com`,
    birthDate: '1990-01-01',
    salary: 500_000,
    position: 'Developer',
    managerId: null,
    manager: null,
    directReportCount: 0,
    avatarUrl: null,
    hasUploadedAvatar: false,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  next += 1;
  return {
    id: `00000000-0000-4000-9000-${String(next).padStart(12, '0')}`,
    employeeId: '00000000-0000-4000-8000-000000000001',
    title: `Task ${next}`,
    status: 'todo',
    dueDate: null,
    assignedBy: null,
    createdAt: '2026-10-20T08:00:00.000Z',
    updatedAt: '2026-10-20T08:00:00.000Z',
    ...overrides,
  };
}
