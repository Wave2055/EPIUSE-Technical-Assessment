import { expect, test, type Page } from '@playwright/test';

/**
 * ADR-0020 specifies exactly one E2E path, against a real API and database:
 * login → create → re-parent → search → delete → verify audit.
 *
 * Needs an API with the seeded admin login. Credentials come from the environment, since the
 * seed password is never committed: E2E_ADMIN_EMAIL (default admin@example.com) and
 * E2E_ADMIN_PASSWORD.
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

// A fresh person per run, so the test can be repeated against the same database.
const suffix = String(Date.now()).slice(-4);
const person = {
  firstName: 'Playwright',
  lastName: `Tester${suffix}`,
  employeeNumber: `E-9${suffix.slice(-3)}`,
  email: `playwright.${suffix}@example.com`,
};
const fullName = `${person.firstName} ${person.lastName}`;

async function pickManager(page: Page, name: RegExp) {
  await page.getByLabel('Reporting line manager').click();
  await page.getByRole('option', { name }).click();
}

test.describe('employee lifecycle', () => {
  test.skip(!adminPassword, 'Set E2E_ADMIN_PASSWORD to the seeded admin password.');

  test('login → create → re-parent → search → delete → verify audit', async ({ page }) => {
    // Login: a protected page sends us to sign in, then back.
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/employees$/);
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();

    // Create, reporting to the CEO.
    await page.getByRole('button', { name: 'Add employee' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('First name').fill(person.firstName);
    await sheet.getByLabel('Surname').fill(person.lastName);
    await sheet.getByLabel('Employee number').fill(person.employeeNumber);
    await sheet.getByRole('button', { name: 'Birth date' }).click();
    await page.getByRole('combobox', { name: /year/i }).selectOption('1991');
    await page.getByRole('combobox', { name: /month/i }).selectOption({ label: 'Mar' });
    await page.getByRole('button', { name: /March 15th, 1991/ }).click();
    await sheet.getByLabel('Email').fill(person.email);
    await sheet.getByLabel('Role / position').fill('QA Engineer');
    await sheet.getByLabel('Annual salary (ZAR)').fill('650000');
    await pickManager(page, /Thandi Nkosi/);
    await sheet.getByRole('button', { name: 'Add employee' }).click();
    await expect(page.getByText(`Added ${fullName}`)).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(fullName) })).toContainText(
      'Thandi Nkosi',
    );

    // Re-parent to the CTO.
    await page.getByRole('button', { name: `Actions for ${fullName}` }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await pickManager(page, /Pieter van Wyk/);
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(`Saved ${fullName}`)).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(fullName) })).toContainText(
      'Pieter van Wyk',
    );

    // Search the org chart, which opens the person's details.
    await page.getByRole('link', { name: 'Org chart' }).click();
    await page.getByRole('button', { name: /Find an employee/ }).click();
    await page.getByPlaceholder('Name, role or employee number').fill(person.employeeNumber);
    await page.getByRole('option', { name: new RegExp(fullName) }).click();
    const details = page.getByRole('complementary');
    await expect(details.getByRole('heading', { name: fullName })).toBeVisible();
    await expect(details).toContainText('Pieter van Wyk');

    // Delete from the details panel.
    await details.getByRole('button', { name: `Delete ${fullName}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete employee' }).click();
    await expect(page.getByText(`Deleted ${fullName}`)).toBeVisible();

    // The audit trail recorded all three changes, attributed to the admin.
    await page.getByRole('link', { name: 'Audit trail' }).click();
    const entries = page.getByRole('row', { name: new RegExp(fullName) });
    await expect(entries).toHaveCount(3);
    await expect(entries.nth(0)).toContainText('Deleted');
    await expect(entries.nth(1)).toContainText('Manager changed');
    await expect(entries.nth(2)).toContainText('Created');
    await expect(entries.nth(2)).toContainText(adminEmail);
  });
});
