import { maskSalary } from './salary-mask.interceptor.js';

describe('maskSalary', () => {
  it('nulls every salary, however deeply nested', () => {
    const body = {
      items: [{ id: 'a', salary: 100, manager: { id: 'b', salary: 200 } }],
      employee: { salary: 300, directReports: [{ salary: 400 }] },
      total: 1,
    };
    expect(maskSalary(body)).toEqual({
      items: [{ id: 'a', salary: null, manager: { id: 'b', salary: null } }],
      employee: { salary: null, directReports: [{ salary: null }] },
      total: 1,
    });
  });

  it('leaves values without a salary untouched', () => {
    expect(maskSalary({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(maskSalary(undefined)).toBeUndefined();
  });
});
