import { admin, apiAs, expect, pickBirthDate, signIn, test, unique } from './fixtures';

test.describe('the employee table', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, admin, '/employees');
  });

  test('searches across fields and filters by role', async ({ page }) => {
    await page.getByLabel('Search employees').fill('khumalo');
    await expect(page.getByRole('row', { name: /Zanele Khumalo/ })).toBeVisible();
    await expect(page.getByText(/^1 of \d+ employees$/)).toBeVisible();

    await page.getByRole('button', { name: /Clear/ }).click();
    await page.getByLabel('Filter by role').click();
    await page.getByRole('option', { name: 'Software Developer', exact: true }).click();
    await expect(page.getByText(/^2 of \d+ employees$/)).toBeVisible();
  });

  test('sorts by salary and filters by a salary range', async ({ page }) => {
    // Numbers sort highest first on the first click, then lowest first.
    const salaryHeader = page.getByRole('button', { name: 'Salary', exact: true });
    await salaryHeader.click();
    await expect(page.getByRole('row').nth(1)).toContainText('Thandi Nkosi');
    await salaryHeader.click();
    await expect(page.getByRole('row').last()).toContainText('Thandi Nkosi');

    await page.getByRole('button', { name: 'Filter by salary' }).click();
    await page.getByLabel('Salary from').fill('2400000');
    await page.keyboard.press('Escape');
    await expect(page.getByText(/^3 of \d+ employees$/)).toBeVisible();
  });

  test('filters by a birth date range', async ({ page }) => {
    await page.getByRole('button', { name: 'Filter by birth date' }).click();
    await page.getByLabel('Birth date from').fill('1995-01-01');
    await page.getByLabel('Birth date to').fill('1996-12-31');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('row', { name: /Zanele Khumalo/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Kagiso Molefe/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Thandi Nkosi/ })).toHaveCount(0);
  });

  test('shows a message when nothing matches', async ({ page }) => {
    await page.getByLabel('Search employees').fill('zzzz-no-match');
    await expect(page.getByText('No employees match these filters.')).toBeVisible();
  });
});

test.describe('the employee form', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, admin, '/employees');
    await page.getByRole('button', { name: 'Add employee' }).click();
  });

  test('explains every missing field before sending', async ({ page }) => {
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Add employee' }).click();
    await expect(sheet.getByText('Enter a first name.')).toBeVisible();
    await expect(sheet.getByText('Enter a surname.')).toBeVisible();
    await expect(sheet.getByText('Enter a role or position.')).toBeVisible();
  });

  test("refuses another employee's number, and says so", async ({ page }) => {
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('First name').fill('Duplicate');
    await sheet.getByLabel('Surname').fill(`Number${unique()}`);
    await sheet.getByLabel('Employee number').fill('E-0001');
    await pickBirthDate(page, '1990', 'Jun', /June 12th, 1990/);
    await sheet.getByLabel('Email').fill(`dup.${unique()}@example.com`);
    await sheet.getByLabel('Role / position').fill('Tester');
    await sheet.getByLabel('Annual salary (ZAR)').fill('100000');
    await sheet.getByRole('button', { name: 'Add employee' }).click();
    await expect(
      sheet.getByText('Another record already uses that employee number.'),
    ).toBeVisible();
    await expect(sheet).toBeVisible();
  });

  test("never offers someone's own team as their manager", async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: `Actions for ${admin.name}` }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await page.getByLabel('Reporting line manager').click();
    const options = page.getByRole('option');
    await expect(options.filter({ hasText: 'Thandi Nkosi' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Lerato Dlamini' })).toHaveCount(1);
    for (const below of ['Pieter van Wyk', 'Aisha Patel', 'Ruan Pretorius', 'Johan Botha']) {
      await expect(options.filter({ hasText: below })).toHaveCount(0);
    }
  });
});

test.describe('deleting a manager', () => {
  test('moves the team up a level by default', async ({ page, request }) => {
    const api = await apiAs(request, admin);
    const tag = unique();
    const thandi = await api.findByNumber('E-0001');
    const manager = await api.createEmployee({
      firstName: 'Gone',
      lastName: `Boss${tag}`,
      managerId: thandi!.id,
    });
    const report = await api.createEmployee({
      firstName: 'Kept',
      lastName: `Report${tag}`,
      managerId: manager.id,
    });

    await signIn(page, admin, '/employees');
    await page.getByRole('button', { name: `Actions for Gone Boss${tag}` }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(`Kept Report${tag}`);
    await dialog.getByRole('button', { name: 'Delete employee' }).click();
    await expect(page.getByText(`Deleted Gone Boss${tag}`)).toBeVisible();

    expect((await api.employee(report.id)).body.managerId).toBe(thandi!.id);
    await api.deleteEmployee(report.id);
  });

  test('can hand the team to someone else', async ({ page, request }) => {
    const api = await apiAs(request, admin);
    const tag = unique();
    const thandi = await api.findByNumber('E-0001');
    const lerato = await api.findByNumber('E-0005');
    const manager = await api.createEmployee({
      firstName: 'Leaving',
      lastName: `Boss${tag}`,
      managerId: thandi!.id,
    });
    const report = await api.createEmployee({
      firstName: 'Moving',
      lastName: `Report${tag}`,
      managerId: manager.id,
    });

    await signIn(page, admin, '/employees');
    await page.getByRole('button', { name: `Actions for Leaving Boss${tag}` }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByText('Hand them over to someone else').click();
    await dialog.getByRole('combobox', { name: 'New manager' }).click();
    await page.getByRole('option', { name: /Lerato Dlamini/ }).click();
    await dialog.getByRole('button', { name: 'Delete employee' }).click();
    await expect(page.getByText(`Deleted Leaving Boss${tag}`)).toBeVisible();

    expect((await api.employee(report.id)).body.managerId).toBe(lerato!.id);
    expect((await api.employee(manager.id)).status).toBe(404);
    await api.deleteEmployee(report.id);
  });
});

test.describe('the org chart', () => {
  test('warns when more than one person has no manager', async ({ page, request }) => {
    const api = await apiAs(request, admin);
    const stray = await api.createEmployee({
      firstName: 'Stray',
      lastName: `Root${unique()}`,
      managerId: null,
    });
    try {
      await signIn(page, admin, '/hierarchy');
      // Other specs may leave people without a manager, so the count can be higher.
      await expect(page.getByText(/^\d+ people have no reporting manager$/)).toBeVisible();
    } finally {
      await api.deleteEmployee(stray.id);
    }
  });
});
