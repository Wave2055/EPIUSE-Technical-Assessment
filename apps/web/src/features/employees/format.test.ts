import { describe, expect, it } from 'vitest';
import { formatSalary, fullName, initials, parseIsoDate, toIsoDate } from './format';

describe('dates', () => {
  it('parses YYYY-MM-DD as a local date, so the day never shifts', () => {
    const d = parseIsoDate('1990-01-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([1990, 0, 1]);
  });

  it('round-trips through toIsoDate, including leap days and year ends', () => {
    for (const iso of ['2024-02-29', '1999-12-31', '2000-01-01']) {
      expect(toIsoDate(parseIsoDate(iso))).toBe(iso);
    }
  });
});

describe('names and money', () => {
  it('says "Hidden" for a masked salary, and formats zero as money', () => {
    expect(formatSalary(null)).toBe('Hidden');
    expect(formatSalary(0)).toMatch(/R\s?0/);
  });

  it('builds initials and full names from accented and empty parts', () => {
    expect(initials({ firstName: 'zoë', lastName: "o'brien" })).toBe('ZO');
    expect(initials({ firstName: '', lastName: 'Nkosi' })).toBe('N');
    expect(fullName({ firstName: 'Thandi', lastName: 'Nkosi' })).toBe('Thandi Nkosi');
  });
});
