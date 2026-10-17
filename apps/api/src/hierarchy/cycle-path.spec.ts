import { findCyclePath } from './cycle-path.js';

const link = (id: string, firstName: string, lastName: string) => ({ id, firstName, lastName });
const botha = link('b', 'Johan', 'Botha');
const patel = link('p', 'Aisha', 'Patel');
const vanWyk = link('v', 'Pieter', 'van Wyk');
const nkosi = link('n', 'Thandi', 'Nkosi');

describe('findCyclePath', () => {
  it('returns null when the employee is not above the new manager', () => {
    expect(findCyclePath(botha, [vanWyk, nkosi])).toBeNull();
  });

  it('names a self-managing loop', () => {
    expect(findCyclePath(botha, [botha])).toEqual(['Johan Botha', 'Johan Botha']);
  });

  it('names a deep loop from the employee back to themselves', () => {
    // Moving van Wyk under Botha, whose chain runs Botha → Patel → van Wyk.
    expect(findCyclePath(vanWyk, [botha, patel, vanWyk, nkosi])).toEqual([
      'Pieter van Wyk',
      'Johan Botha',
      'Aisha Patel',
      'Pieter van Wyk',
    ]);
  });
});
