import { createHash } from 'node:crypto';

/**
 * Gravatar addresses an avatar by a hash of the email. SHA-256 rather than the legacy MD5
 * (ADR-0013). `d=404` makes a missing avatar fail, so the browser falls back to initials.
 */
export function gravatarUrl(email: string): string {
  const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  return `https://gravatar.com/avatar/${hash}?s=160&d=404`;
}
