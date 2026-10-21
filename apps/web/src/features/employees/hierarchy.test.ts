import { describe, expect, it } from 'vitest';
import { makeEmployee } from '@/test/fixtures';
import { getDescendantIds, getDirectReports, getEligibleManagers, getRoots } from './hierarchy';

// ceo → cto → lead → dev, and ceo → cfo
const ceo = makeEmployee();
const cto = makeEmployee({ managerId: ceo.id });
const cfo = makeEmployee({ managerId: ceo.id });
const lead = makeEmployee({ managerId: cto.id });
const dev = makeEmployee({ managerId: lead.id });
const org = [ceo, cto, cfo, lead, dev];

describe('getDescendantIds', () => {
  it('collects the whole subtree, however deep, but not the employee', () => {
    expect(getDescendantIds(org, cto.id)).toEqual(new Set([lead.id, dev.id]));
    expect(getDescendantIds(org, ceo.id).size).toBe(4);
  });

  it('is empty for someone with no reports, or an unknown id', () => {
    expect(getDescendantIds(org, dev.id).size).toBe(0);
    expect(getDescendantIds(org, 'missing').size).toBe(0);
  });

  it('terminates even if the data somehow contains a loop', () => {
    const a = makeEmployee();
    const b = makeEmployee({ managerId: a.id });
    a.managerId = b.id;
    expect(getDescendantIds([a, b], a.id)).toEqual(new Set([a.id, b.id]));
  });
});

describe('getEligibleManagers', () => {
  it("leaves out the employee and everyone below them, so a loop can't be picked", () => {
    const ids = getEligibleManagers(org, cto.id).map((e) => e.id);
    expect(ids).toEqual([ceo.id, cfo.id]);
  });

  it('offers everyone when creating a new employee', () => {
    expect(getEligibleManagers(org, undefined)).toHaveLength(org.length);
  });

  it('offers everyone but themselves to a person with no reports', () => {
    expect(getEligibleManagers(org, dev.id)).toHaveLength(org.length - 1);
  });
});

describe('roots and reports', () => {
  it('finds every top-level employee, not just the first', () => {
    const stray = makeEmployee();
    expect(getRoots([...org, stray]).map((e) => e.id)).toEqual([ceo.id, stray.id]);
  });

  it('lists direct reports only', () => {
    expect(getDirectReports(org, ceo.id).map((e) => e.id)).toEqual([cto.id, cfo.id]);
  });
});
