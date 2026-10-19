export interface ChainLink {
  id: string;
  firstName: string;
  lastName: string;
}

const name = (link: ChainLink) => `${link.firstName} ${link.lastName}`;

/**
 * Given the employee being moved and the proposed manager's chain upward (manager first),
 * returns the loop as names — `[employee, manager, …, employee]` — or `null` if the employee
 * is not on the chain, i.e. the move is safe (ADR-0008).
 */
export function findCyclePath(employee: ChainLink, managerChain: ChainLink[]): string[] | null {
  const index = managerChain.findIndex((link) => link.id === employee.id);
  if (index === -1) return null;
  return [name(employee), ...managerChain.slice(0, index + 1).map(name)];
}
