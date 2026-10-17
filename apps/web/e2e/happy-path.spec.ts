import { expect, test } from '@playwright/test';

/**
 * ADR-0020 specifies exactly one E2E path, against a real API and database:
 * login → create → re-parent → search → delete → verify audit.
 *
 * Skipped until the routes it drives exist.
 */
test.describe('employee lifecycle', () => {
  test.skip('login → create → re-parent → search → delete → verify audit', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Employee Hierarchy/);
  });
});
