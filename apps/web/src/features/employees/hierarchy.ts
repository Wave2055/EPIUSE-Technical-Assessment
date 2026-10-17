import type { Employee } from './types';

/** Every employee below `id` in the reporting tree. Used to keep cycles out of manager pickers (ADR-0008). */
export function getDescendantIds(employees: Employee[], id: string): Set<string> {
  const byManager = groupByManager(employees);
  const found = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const report of byManager.get(current) ?? []) {
      if (!found.has(report.id)) {
        found.add(report.id);
        stack.push(report.id);
      }
    }
  }
  return found;
}

/** Valid managers for `id`: anyone except the employee and their own subtree. */
export function getEligibleManagers(employees: Employee[], id: string | undefined): Employee[] {
  if (!id) return employees;
  const excluded = getDescendantIds(employees, id);
  excluded.add(id);
  return employees.filter((e) => !excluded.has(e.id));
}

export function getDirectReports(employees: Employee[], id: string): Employee[] {
  return employees.filter((e) => e.managerId === id);
}

/** More than one root is a data-quality warning, not an error (ADR-0009). */
export function getRoots(employees: Employee[]): Employee[] {
  return employees.filter((e) => e.managerId === null);
}

function groupByManager(employees: Employee[]): Map<string | null, Employee[]> {
  const map = new Map<string | null, Employee[]>();
  for (const e of employees) {
    const list = map.get(e.managerId) ?? [];
    list.push(e);
    map.set(e.managerId, list);
  }
  return map;
}
