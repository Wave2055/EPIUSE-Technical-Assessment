import type { Edge, Node } from '@xyflow/react';
import { stratify, tree } from 'd3-hierarchy';
import type { Employee } from '@/features/employees/types';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 64;
const H_GAP = 24;
const V_GAP = 56;
const FOREST_ROOT = '__forest__';

export type EmployeeNode = Node<{ employee: Employee; reportCount: number }, 'employee'>;

/**
 * Lays out the org chart with d3's tidy tree. Multiple roots are allowed (ADR-0009), so every
 * root hangs off one invisible parent and the result renders as a forest.
 */
export function layoutHierarchy(employees: Employee[]): { nodes: EmployeeNode[]; edges: Edge[] } {
  if (employees.length === 0) return { nodes: [], edges: [] };

  const reportCount = new Map<string, number>();
  for (const e of employees) {
    if (e.managerId) reportCount.set(e.managerId, (reportCount.get(e.managerId) ?? 0) + 1);
  }

  type Item = { id: string; parentId: string | null; employee?: Employee };
  const items: Item[] = [
    { id: FOREST_ROOT, parentId: null },
    ...employees.map((e) => ({ id: e.id, parentId: e.managerId ?? FOREST_ROOT, employee: e })),
  ];

  const root = stratify<Item>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(items);
  // Biggest subtree first, so the CEO's tree leads and stray roots trail it.
  root.sort(
    (a, b) =>
      b.height - a.height ||
      (a.data.employee?.lastName ?? '').localeCompare(b.data.employee?.lastName ?? ''),
  );
  tree<Item>().nodeSize([NODE_WIDTH + H_GAP, NODE_HEIGHT + V_GAP])(root);

  const nodes: EmployeeNode[] = [];
  const edges: Edge[] = [];
  for (const d of root.descendants()) {
    const employee = d.data.employee;
    if (!employee) continue;
    nodes.push({
      id: employee.id,
      type: 'employee',
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      position: { x: d.x! - NODE_WIDTH / 2, y: (d.depth - 1) * (NODE_HEIGHT + V_GAP) },
      data: { employee, reportCount: reportCount.get(employee.id) ?? 0 },
    });
    if (employee.managerId) {
      edges.push({
        id: `${employee.managerId}->${employee.id}`,
        source: employee.managerId,
        target: employee.id,
        type: 'smoothstep',
      });
    }
  }
  return { nodes, edges };
}
