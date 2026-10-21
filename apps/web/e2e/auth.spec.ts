import { admin, expect, signIn, test } from './fixtures';

test.describe('signing in and out', () => {
  test('sends a signed-out visitor to sign in, then back where they were going', async ({
    page,
  }) => {
    await page.goto('/hierarchy');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email').fill(admin.email);
    await page.getByLabel('Password').fill(admin.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/hierarchy$/);
    await expect(page.getByRole('heading', { name: 'Org chart' })).toBeVisible();
  });

  test('refuses a wrong password without saying which half was wrong', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(admin.email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('That email and password do not match an account.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('checks the form before sending anything', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter the email address you sign in with.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();
  });

  test('keeps the session across a reload and a new tab', async ({ page, context }) => {
    await signIn(page, admin, '/employees');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();

    const tab = await context.newPage();
    await tab.goto('/audit');
    await expect(tab.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  });

  test('signing out ends the session for good', async ({ page }) => {
    await signIn(page, admin);
    await page.getByRole('button', { name: new RegExp(admin.email) }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/employees');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('blocks sign-in after ten wrong passwords, even with the right one', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(admin.email);
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.getByLabel('Password').fill(`wrong-${attempt}`);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(
        page.getByText('That email and password do not match an account.'),
      ).toBeVisible();
    }
    await page.getByLabel('Password').fill(admin.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Too many requests. Wait a moment and try again.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows a not-found page for an unknown address', async ({ page }) => {
    await signIn(page, admin, '/no-such-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
