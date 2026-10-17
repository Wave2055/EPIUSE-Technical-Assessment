import argon2 from 'argon2';

/** argon2id, the current password-hashing recommendation (ADR-0014). */
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);
