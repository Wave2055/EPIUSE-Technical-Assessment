import { randomInt } from 'node:crypto';
import argon2 from 'argon2';

/** argon2id, the current password-hashing recommendation (ADR-0014). */
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);

/** No 0/O, 1/l/I: an admin reads this to someone, who types it once. */
export const TEMPORARY_PASSWORD_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export const TEMPORARY_PASSWORD_LENGTH = 16;

/**
 * A one-time password for a new or reset login (ADR-0036). 16 characters from 55 is about
 * 92 bits, drawn with the CSPRNG; the user replaces it at first sign-in.
 */
export function generateTemporaryPassword(): string {
  let password = '';
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) {
    password += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  }
  return password;
}
