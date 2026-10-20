import { expect, signIn, test, viewer } from './fixtures';

test.describe('a read-only viewer', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, viewer, '/employees');
  });

  test('sees the organisation but no salaries and no way to change it', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    const thandi = page.getByRole('row', { name: /^TN Thandi Nkosi/ });
    await expect(thandi).toContainText('Hidden');
    await expect(page.getByText(/R\s?3\s?250\s?000/)).toHaveCount(0);

    await expect(page.getByRole('button', { name: 'Add employee' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Actions for/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Filter by salary' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salary', exact: true })).toHaveCount(0);
  });

  test('cannot edit or delete from the org chart', async ({ page }) => {
    await page.getByRole('link', { name: 'Org chart' }).click();
    await page.getByRole('button', { name: /Find an employee/ }).click();
    await page.getByPlaceholder('Name, role or employee number').fill('Johan');
    await page.getByRole('option', { name: /Johan Botha/ }).click();
    const details = page.getByRole('complementary');
    await expect(details.getByRole('heading', { name: 'Johan Botha' })).toBeVisible();
    await expect(details.getByRole('button', { name: /Delete|Edit/ })).toHaveCount(0);
  });

  test('is told the audit trail is for admins', async ({ page }) => {
    await page.goto('/audit');
    await expect(
      page.getByRole('heading', { name: 'The audit trail is for admins' }),
    ).toBeVisible();
  });

  test("sees their own team's tasks on the home page", async ({ page }) => {
    await page.getByRole('link', { name: 'Home' }).click();
    await page.getByRole('tab', { name: /Team tasks/ }).click();
    await expect(page.getByText('Refactor reporting-line service')).toBeVisible();
    await expect(page.getByText('Build org chart search')).toBeVisible();
  });
});
