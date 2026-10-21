import {
  generateTemporaryPassword,
  TEMPORARY_PASSWORD_ALPHABET,
  TEMPORARY_PASSWORD_LENGTH,
} from './password.js';

describe('generateTemporaryPassword', () => {
  it('draws 16 characters from an alphabet with no look-alikes', () => {
    const password = generateTemporaryPassword();
    expect(password).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
    for (const c of password) expect(TEMPORARY_PASSWORD_ALPHABET).toContain(c);
    expect(TEMPORARY_PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/);
  });

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 500 }, generateTemporaryPassword));
    expect(seen.size).toBe(500);
  });

  it('meets the 12-character minimum every password must', () => {
    expect(TEMPORARY_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});
