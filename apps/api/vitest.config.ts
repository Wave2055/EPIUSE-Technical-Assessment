import { defineConfig } from 'vitest/config';

/**
 * Unit layer (ADR-0020): logic with its dependencies injected, no database and no container,
 * so this is the suite that runs on watch. Integration lives in vitest.config.integration.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
