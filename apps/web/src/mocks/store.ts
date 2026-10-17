import { useSyncExternalStore } from 'react';
import { fullName } from '@/features/employees/format';
import { getDescendantIds, getDirectReports } from '@/features/employees/hierarchy';
import type {
  AuditAction,
  AuditEntry,
  DeleteStrategy,
  Employee,
  EmployeeInput,
  Role,
} from '@/features/employees/types';
import { auditFixtures, employeeFixtures } from './fixtures';

/**
 * In-memory stand-in for the API, so the screens can be clicked through end to end. It
 * mirrors the server rules the UI depends on (cycle rejection, delete strategies, salary
 * masking, audit rows) and is replaced wholesale by TanStack Query hooks. See fixtures.ts.
 */

interface State {
  employees: Employee[];
  audit: AuditEntry[];
  role: Role;
}

let state: State = { employees: employeeFixtures, audit: auditFixtures, role: 'ADMIN' };
const listeners = new Set<() => void>();
let nextAuditId = Math.max(...auditFixtures.map((a) => a.id)) + 1;

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/** The API strips salary for a VIEWER; the mock does the same so the UI is built against it. */
const maskedCache = new WeakMap<Employee[], Employee[]>();
function masked(employees: Employee[], role: Role): Employee[] {
  if (role === 'ADMIN') return employees;
  let result = maskedCache.get(employees);
  if (!result) {
    result = employees.map((e) => ({ ...e, salary: null }));
    maskedCache.set(employees, result);
  }
  return result;
}

export const useEmployees = () =>
  masked(
    useStore((s) => s.employees),
    useStore((s) => s.role),
  );
export const useAudit = () => useStore((s) => s.audit);
export const useRole = () => useStore((s) => s.role);
export const setRole = (role: Role) => setState({ role });

function audit(employee: Employee, action: AuditAction, summary: string): AuditEntry {
  return {
    id: nextAuditId++,
    employeeId: employee.id,
    employeeName: fullName(employee),
    action,
    changedBy: 'admin@example.com',
    changedAt: new Date().toISOString(),
    summary,
  };
}

export class MockRuleError extends Error {}

export function saveEmployee(input: EmployeeInput, id?: string): Employee {
  const { employees } = state;
  if (
    id &&
    input.managerId &&
    (input.managerId === id || getDescendantIds(employees, id).has(input.managerId))
  ) {
    throw new MockRuleError(
      'That manager reports to this employee, which would create a reporting loop.',
    );
  }
  if (employees.some((e) => e.employeeNumber === input.employeeNumber && e.id !== id)) {
    throw new MockRuleError(`Employee number ${input.employeeNumber} is already in use.`);
  }

  if (!id) {
    const created: Employee = { ...input, id: crypto.randomUUID(), avatarUrl: null };
    setState({
      employees: [...employees, created],
      audit: [audit(created, 'CREATE', 'Created'), ...state.audit],
    });
    return created;
  }

  const before = employees.find((e) => e.id === id)!;
  const updated: Employee = { ...before, ...input };
  const action: AuditAction = before.managerId !== input.managerId ? 'REPARENT' : 'UPDATE';
  setState({
    employees: employees.map((e) => (e.id === id ? updated : e)),
    audit: [
      audit(updated, action, action === 'REPARENT' ? 'Manager changed' : 'Details updated'),
      ...state.audit,
    ],
  });
  return updated;
}

/** Mirrors ADR-0010: reports move to the grandparent (`promote`) or a nominated manager (`reassign`). */
export function deleteEmployee(id: string, strategy: DeleteStrategy, reassignTo?: string) {
  const { employees } = state;
  const target = employees.find((e) => e.id === id)!;
  const reports = getDirectReports(employees, id);
  const newManagerId = strategy === 'promote' ? target.managerId : (reassignTo ?? null);

  if (reports.length > 0 && target.managerId === null && strategy === 'promote') {
    throw new MockRuleError('A top-level employee with reports needs a new manager for them.');
  }

  const entries = reports.map((r) =>
    audit(r, 'REPARENT', `Moved after ${fullName(target)} was deleted`),
  );
  setState({
    employees: employees
      .filter((e) => e.id !== id)
      .map((e) => (e.managerId === id ? { ...e, managerId: newManagerId } : e)),
    audit: [
      audit(
        target,
        'DELETE',
        `Deleted; ${reports.length} direct report${reports.length === 1 ? '' : 's'} moved`,
      ),
      ...entries,
      ...state.audit,
    ],
  });
}
