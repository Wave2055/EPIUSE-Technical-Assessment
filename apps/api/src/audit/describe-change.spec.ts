import { describeChange, diffSnapshots } from './describe-change.js';

const before = {
  id: 'z',
  first_name: 'Zanele',
  last_name: 'Khumalo',
  position: 'Junior Developer',
  salary: 600000,
  manager_id: 'p',
  updated_at: '2026-10-01',
};
const names = (id: string) => ({ p: 'Aisha Patel', r: 'Ruan Pretorius' })[id] ?? null;

describe('describeChange', () => {
  it('summarises an update by the fields that changed', () => {
    const after = { ...before, position: 'Software Developer', salary: 720000, updated_at: 'x' };
    expect(describeChange('UPDATE', before, after, names)).toBe('Position and salary updated');
  });

  it('names both managers on a re-parent', () => {
    const after = { ...before, manager_id: 'r' };
    expect(describeChange('REPARENT', before, after, names)).toBe(
      'Manager changed from Aisha Patel to Ruan Pretorius',
    );
  });

  it('copes with a manager who has since been deleted', () => {
    const after = { ...before, manager_id: 'gone' };
    expect(describeChange('REPARENT', before, after, names)).toBe(
      'Manager changed from Aisha Patel to a former employee',
    );
  });

  it('describes a top-level creation', () => {
    expect(describeChange('CREATE', null, { ...before, manager_id: null }, names)).toBe(
      'Created with no reporting manager',
    );
  });
});

describe('diffSnapshots', () => {
  it('lists changed fields in camelCase and ignores timestamps', () => {
    const after = { ...before, salary: 720000, updated_at: 'later' };
    expect(diffSnapshots(before, after)).toEqual([{ field: 'salary', from: 600000, to: 720000 }]);
  });
});
