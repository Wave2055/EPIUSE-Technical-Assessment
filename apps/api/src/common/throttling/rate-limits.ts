import { minutes } from '@nestjs/throttler';

/**
 * Limits are per client address and per route, held in memory: the API runs as a single
 * instance (ADR-0015), so there is no shared store to keep in step.
 */

/** Every route. Generous enough that paging and the org chart never meet it in normal use. */
export const DEFAULT_RATE_LIMIT = { limit: 300, ttl: minutes(1) };

/**
 * Sign-in attempts. Ten tries per quarter hour covers mistyped passwords; past that the
 * address is blocked for fifteen minutes, which makes guessing passwords impractical.
 */
export const LOGIN_RATE_LIMIT = { limit: 10, ttl: minutes(15), blockDuration: minutes(15) };
