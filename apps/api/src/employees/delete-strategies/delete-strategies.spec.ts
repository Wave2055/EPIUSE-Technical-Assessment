import type { HierarchyService } from '../../hierarchy/hierarchy.service.js';
import type { Tx } from '../../prisma/prisma.service.js';
import { PromoteStrategy } from './promote.strategy.js';
import { ReassignStrategy } from './reassign.strategy.js';

const tx = {} as Tx;
const target = { id: 'p', firstName: 'Aisha', lastName: 'Patel', managerId: 'v' };
const root = { ...target, id: 'n', firstName: 'Thandi', lastName: 'Nkosi', managerId: null };

describe('PromoteStrategy', () => {
  const promote = new PromoteStrategy();

  it("moves reports to the deleted employee's manager", async () => {
    await expect(promote.newManagerFor({ tx, target })).resolves.toBe('v');
  });

  it('refuses for a top-level employee, who has no manager to promote to', () => {
    expect(() => promote.newManagerFor({ tx, target: root })).toThrow(
      expect.objectContaining({ code: 'ROOT_DELETE_NEEDS_REASSIGN' }),
    );
  });
});

describe('ReassignStrategy', () => {
  /** A fake whose chain for any start id is fixed per test. */
  const withChain = (chain: { id: string; firstName: string; lastName: string }[]) =>
    new ReassignStrategy({
      ancestorChain: () => Promise.resolve(chain),
    } as unknown as HierarchyService);

  it('moves reports to the nominated employee', async () => {
    const strategy = withChain([{ id: 'r', firstName: 'Ruan', lastName: 'Pretorius' }]);
    await expect(strategy.newManagerFor({ tx, target, reassignTo: 'r' })).resolves.toBe('r');
  });

  it('requires a nominee', async () => {
    await expect(withChain([]).newManagerFor({ tx, target })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('refuses someone who does not exist', async () => {
    await expect(
      withChain([]).newManagerFor({ tx, target, reassignTo: 'x' }),
    ).rejects.toMatchObject({
      code: 'UNKNOWN_MANAGER',
    });
  });

  it("refuses someone inside the deleted manager's own subtree", async () => {
    const strategy = withChain([
      { id: 'b', firstName: 'Johan', lastName: 'Botha' },
      { id: 'p', firstName: 'Aisha', lastName: 'Patel' },
    ]);
    await expect(strategy.newManagerFor({ tx, target, reassignTo: 'b' })).rejects.toMatchObject({
      code: 'HIERARCHY_CYCLE',
      details: { path: ['Johan Botha', 'Aisha Patel'] },
    });
  });
});
