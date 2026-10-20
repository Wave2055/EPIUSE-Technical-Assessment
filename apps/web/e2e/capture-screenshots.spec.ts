import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { admin, expect, signIn, test, viewer } from './fixtures';

/**
 * Regenerates the screenshots in docs/images for the user guide. Skipped unless asked for:
 *
 *   CAPTURE_SCREENSHOTS=1 pnpm test:e2e:docker capture-screenshots
 *
 * Runs against a freshly seeded stack, so the pictures show the seed organisation.
 */
const out = (name: string) =>
  fileURLToPath(new URL(`../../../docs/images/${name}.png`, import.meta.url));
/** Waits out the open/close animations of dialogs and popovers first. */
async function shot(page: Page, name: string) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: out(name) });
}

test.describe('user guide screenshots', () => {
  test.skip(!process.env.CAPTURE_SCREENSHOTS, 'Set CAPTURE_SCREENSHOTS=1 to regenerate.');
  test.use({ viewport: { width: 1280, height: 800 } });

  test('as an admin', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in').first()).toBeVisible();
    await shot(page, 'login');

    await signIn(page, admin);
    await expect(page.getByText('Your team')).toBeVisible();
    await shot(page, 'home');
    await page.getByRole('tab', { name: /Team tasks/ }).click();
    await shot(page, 'home-team-tasks');

    await page.goto('/hierarchy');
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, 'org-chart');
    await page.getByRole('button', { name: /Find an employee/ }).click();
    await page.getByPlaceholder('Name, role or employee number').fill('dev');
    await shot(page, 'org-chart-search');
    await page.getByRole('option', { name: /Johan Botha/ }).click();
    await expect(page.getByRole('complementary')).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, 'org-chart-details');

    await page.goto('/employees');
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    await shot(page, 'employees');
    await page.getByRole('button', { name: 'Filter by salary' }).click();
    await page.getByLabel('Salary from').fill('1000000');
    await shot(page, 'employees-salary-filter');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Clear/ }).click();

    await page.getByRole('button', { name: 'Add employee' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, 'employee-form');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Actions for Aisha Patel' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await shot(page, 'delete-dialog');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
    await shot(page, 'audit');
  });

  test('as a viewer', async ({ page }) => {
    await signIn(page, viewer, '/employees');
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    await shot(page, 'viewer-employees');
  });
});
