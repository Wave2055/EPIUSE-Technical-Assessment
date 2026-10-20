import { describe, expect, it } from 'vitest';
import { makeEmployee } from '@/test/fixtures';
import { layoutHierarchy, NODE_WIDTH } from './layout';

describe('layoutHierarchy', () => {
  it('lays out nothing for an empty organisation', () => {
    expect(layoutHierarchy([])).toEqual({ nodes: [], edges: [] });
  });

  it('draws one node per employee and one edge per reporting line', () => {
    const ceo = makeEmployee();
    const a = makeEmployee({ managerId: ceo.id });
    const b = makeEmployee({ managerId: ceo.id });
    const { nodes, edges } = layoutHierarchy([ceo, a, b]);
    expect(nodes).toHaveLength(3);
    expect(edges.map((e) => [e.source, e.target])).toEqual(
      expect.arrayContaining([
        [ceo.id, a.id],
        [ceo.id, b.id],
      ]),
    );
    expect(nodes.find((n) => n.id === ceo.id)?.data.reportCount).toBe(2);
  });

  it('draws several roots as a forest, with no node for the hidden parent', () => {
    const roots = [makeEmployee(), makeEmployee(), makeEmployee()];
    const { nodes, edges } = layoutHierarchy(roots);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(0);
    expect(new Set(nodes.map((n) => n.position.y)).size).toBe(1);
  });

  it('puts each level below its manager and never overlaps nodes in a row', () => {
    const ceo = makeEmployee();
    const team = Array.from({ length: 6 }, () => makeEmployee({ managerId: ceo.id }));
    const { nodes } = layoutHierarchy([ceo, ...team]);
    const top = nodes.find((n) => n.id === ceo.id)!;
    const row = nodes
      .filter((n) => n.id !== ceo.id)
      .map((n) => n.position.x)
      .sort((x, y) => x - y);
    expect(nodes.every((n) => n.id === ceo.id || n.position.y > top.position.y)).toBe(true);
    for (let i = 1; i < row.length; i++) {
      expect(row[i]! - row[i - 1]!).toBeGreaterThanOrEqual(NODE_WIDTH);
    }
  });
});
