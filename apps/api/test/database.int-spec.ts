import { startTestApp, insertEmployee, type TestApp } from './support/test-app.js';

/**
 * The database guarantees, asserted by writing raw SQL that bypasses the API entirely
 * (ADR-0020). If the service check ever disagrees with these, the trigger is right.
 */
describe('database invariants', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp();
  });
  afterAll(() => t?.close());

  it('refuses a self-managing row (CHECK constraint)', async () => {
    const a = await insertEmployee(t.prisma);
    await expect(
      t.prisma.$executeRaw`UPDATE employees SET manager_id = id WHERE id = ${a.id}::uuid`,
    ).rejects.toThrow();
  });

  it('refuses a two-person loop', async () => {
    const a = await insertEmployee(t.prisma);
    const b = await insertEmployee(t.prisma, { managerId: a.id });
    await expect(
      t.prisma
        .$executeRaw`UPDATE employees SET manager_id = ${b.id}::uuid WHERE id = ${a.id}::uuid`,
    ).rejects.toThrow(/HC001|Reporting cycle/);
  });

  it('refuses a deep loop', async () => {
    const a = await insertEmployee(t.prisma);
    const b = await insertEmployee(t.prisma, { managerId: a.id });
    const c = await insertEmployee(t.prisma, { managerId: b.id });
    await expect(
      t.prisma
        .$executeRaw`UPDATE employees SET manager_id = ${c.id}::uuid WHERE id = ${a.id}::uuid`,
    ).rejects.toThrow(/HC001|Reporting cycle/);
  });

  it('refuses re-parenting a node into its own subtree', async () => {
    const a = await insertEmployee(t.prisma);
    const b = await insertEmployee(t.prisma, { managerId: a.id });
    const c = await insertEmployee(t.prisma, { managerId: b.id });
    const d = await insertEmployee(t.prisma, { managerId: c.id });
    await expect(
      t.prisma
        .$executeRaw`UPDATE employees SET manager_id = ${d.id}::uuid WHERE id = ${b.id}::uuid`,
    ).rejects.toThrow(/HC001|Reporting cycle/);
  });

  it('still audits a write made outside the API, attributed to nobody', async () => {
    const a = await insertEmployee(t.prisma);
    await t.prisma.$executeRaw`UPDATE employees SET position = 'Changed' WHERE id = ${a.id}::uuid`;
    const rows = await t.prisma.employeeAudit.findMany({
      where: { employeeId: a.id },
      orderBy: { id: 'asc' },
    });
    expect(rows.map((r) => r.action)).toEqual(['CREATE', 'UPDATE']);
    expect(rows.every((r) => r.changedBy === null)).toBe(true);
  });

  it('records a manager change as REPARENT', async () => {
    const a = await insertEmployee(t.prisma);
    const b = await insertEmployee(t.prisma);
    const c = await insertEmployee(t.prisma, { managerId: a.id });
    await t.prisma
      .$executeRaw`UPDATE employees SET manager_id = ${b.id}::uuid WHERE id = ${c.id}::uuid`;
    const last = await t.prisma.employeeAudit.findFirst({
      where: { employeeId: c.id },
      orderBy: { id: 'desc' },
    });
    expect(last?.action).toBe('REPARENT');
  });
});
