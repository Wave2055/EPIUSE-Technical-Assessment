import { defineConfig } from 'vitest/config';

/**
 * Integration layer (ADR-0020): the full HTTP surface, constraints, triggers and recursive
 * queries, against a real PostgreSQL instance rather than a mock.
 *
 * Kept separate from the unit config because container startup is seconds, not
 * milliseconds, so only unit tests run on watch. No suites exist yet — the database layer
 * is not written.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.int-spec.ts'],
    // A container per suite consumes real memory, which matters on CI runners.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    passWithNoTests: true,
  },
});
