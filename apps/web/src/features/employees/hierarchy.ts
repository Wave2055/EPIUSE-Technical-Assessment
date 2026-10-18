/** Anything placed in the reporting tree: an employee, an org chart node, a reference. */
interface TreeMember {
  id: string;
  managerId: string | null;
}

/** Every member below `id` in the reporting tree. Keeps loops out of manager pickers (ADR-0008). */
export function getDescendantIds<T extends TreeMember>(members: T[], id: string): Set<string> {
  const byManager = new Map<string | null, T[]>();
  for (const m of members) {
    const list = byManager.get(m.managerId) ?? [];
    list.push(m);
    byManager.set(m.managerId, list);
  }
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

/** Valid managers for `id`: anyone except the member and their own subtree. */
export function getEligibleManagers<T extends TreeMember>(
  members: T[],
  id: string | undefined,
): T[] {
  if (!id) return members;
  const excluded = getDescendantIds(members, id);
  excluded.add(id);
  return members.filter((m) => !excluded.has(m.id));
}

export function getDirectReports<T extends TreeMember>(members: T[], id: string): T[] {
  return members.filter((m) => m.managerId === id);
}

/** More than one root is a data-quality warning, not an error (ADR-0009). */
export function getRoots<T extends TreeMember>(members: T[]): T[] {
  return members.filter((m) => m.managerId === null);
}
