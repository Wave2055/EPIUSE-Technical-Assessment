import type { Browser, Page } from '@playwright/test';
import {
  activateLogin,
  admin,
  apiAs,
  employeeNumber,
  expect,
  pickBirthDate,
  signIn,
  test,
  unique,
  viewer,
} from './fixtures';

/**
 * Accounts (ADR-0036): every employee gets a login; admins issue one-time passwords, promote,
 * demote and deactivate; people choose their own password on first sign-in and can change it.
 */

/** A second person, in their own browser session and their own rate-limit bucket. */
async function asSomeoneElse(browser: Browser) {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'X-E2E-Client': `e2e-other-${unique()}-${Date.now()}` },
  });
  return { context, page: await context.newPage() };
}

async function signInAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Signs in and waits until it has worked, so the next step runs signed in. */
async function signedInAs(page: Page, email: string, password: string) {
  await signInAs(page, email, password);
  await expect(page).not.toHaveURL(/\/login$/);
}

async function openAccessMenu(page: Page, name: string) {
  await page.goto('/users');
  await page.getByRole('button', { name: `Access for ${name}` }).click();
}

test.describe('accounts', () => {
  test('adding an employee creates their login, and they choose their own password', async ({
    page,
    browser,
  }) => {
    const tag = unique();
    const name = `Nomsa Starter${tag}`;
    const email = `nomsa.${tag}@example.com`;

    await signIn(page, admin, '/employees');
    await page.getByRole('button', { name: 'Add employee' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('First name').fill('Nomsa');
    await sheet.getByLabel('Surname').fill(`Starter${tag}`);
    await sheet.getByLabel('Employee number').fill(employeeNumber());
    await pickBirthDate(page, '1994', 'Jul', /July 7th, 1994/);
    await sheet.getByLabel('Email').fill(email);
    await sheet.getByLabel('Role / position').fill('Analyst');
    await sheet.getByLabel('Annual salary (ZAR)').fill('450000');
    await sheet.getByRole('button', { name: 'Add employee' }).click();

    await expect(page.getByRole('heading', { name: 'Login created' })).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText(email);
    const temporary = (await page
      .getByLabel('One-time password', { exact: true })
      .textContent())!.trim();
    expect(temporary).toMatch(/^[A-Za-z2-9]{16}$/);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText(temporary)).toHaveCount(0);

    // The new person signs in with it and is held until they choose their own.
    const them = await asSomeoneElse(browser);
    await signInAs(them.page, email, temporary);
    await expect(them.page).toHaveURL(/\/change-password$/);
    await them.page.goto('/employees');
    await expect(them.page).toHaveURL(/\/change-password$/);

    await them.page.getByLabel('One-time password', { exact: true }).fill(temporary);
    await them.page.getByLabel('New password', { exact: true }).fill('my own chosen phrase');
    await them.page.getByLabel('Confirm new password').fill('my own chosen phrase');
    await them.page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(them.page.getByText('Your password has been changed.')).toBeVisible();
    // Back to the page they were trying to open.
    await expect(them.page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    await expect(them.page.getByRole('button', { name: new RegExp(email) })).toBeVisible();

    // The one-time password no longer works; theirs does.
    await them.page.getByRole('button', { name: new RegExp(email) }).click();
    await them.page.getByRole('menuitem', { name: 'Sign out' }).click();
    await signInAs(them.page, email, temporary);
    await expect(
      them.page.getByText('That email and password do not match an account.'),
    ).toBeVisible();
    await signedInAs(them.page, email, 'my own chosen phrase');
    await them.context.close();
  });

  test('an admin promotes a user, who gets admin controls at once, then demotes them', async ({
    page,
    browser,
    request,
  }) => {
    const api = await apiAs(request, admin);
    const person = await api.createEmployee({
      firstName: 'Promo',
      lastName: `Ted${unique()}`,
      managerId: null,
    });
    const login = await activateLogin(request, person.login, 'promotion test phrase');
    const name = `${person.firstName} ${person.lastName}`;

    const them = await asSomeoneElse(browser);
    await signedInAs(them.page, login.email, login.password);
    await them.page.goto('/employees');
    await expect(them.page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    await expect(them.page.getByRole('button', { name: 'Add employee' })).toHaveCount(0);
    await expect(them.page.getByRole('link', { name: 'Users' })).toHaveCount(0);

    await signIn(page, admin);
    await openAccessMenu(page, name);
    await page.getByRole('menuitem', { name: 'Make admin' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Make admin' }).click();
    await expect(page.getByText(`${name} is now an admin`)).toBeVisible();
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText('Admin');

    // Same session, no sign-in again: the API reads the role on every request.
    await them.page.reload();
    await expect(them.page.getByRole('button', { name: 'Add employee' })).toBeVisible();
    await expect(them.page.getByRole('link', { name: 'Users' })).toBeVisible();

    await openAccessMenu(page, name);
    await page.getByRole('menuitem', { name: 'Make regular user' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Make regular user' }).click();
    await expect(page.getByText(`${name} is now a regular user`)).toBeVisible();

    // Demotion signs them out.
    await them.page.reload();
    await expect(them.page).toHaveURL(/\/login$/);
    await them.context.close();
    await api.deleteEmployee(person.id);
  });

  test('a deactivated user is signed out at once and cannot sign in until reactivated', async ({
    page,
    browser,
    request,
  }) => {
    const api = await apiAs(request, admin);
    const person = await api.createEmployee({
      firstName: 'Gone',
      lastName: `Quiet${unique()}`,
      managerId: null,
    });
    const login = await activateLogin(request, person.login, 'deactivation test phrase');
    const name = `${person.firstName} ${person.lastName}`;

    const them = await asSomeoneElse(browser);
    await signedInAs(them.page, login.email, login.password);

    await signIn(page, admin);
    await openAccessMenu(page, name);
    await page.getByRole('menuitem', { name: 'Deactivate' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click();
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('Deactivated');

    await them.page.goto('/employees');
    await expect(them.page).toHaveURL(/\/login$/);
    await signInAs(them.page, login.email, login.password);
    await expect(
      them.page.getByText('That email and password do not match an account.'),
    ).toBeVisible();

    await openAccessMenu(page, name);
    await page.getByRole('menuitem', { name: 'Reactivate' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reactivate' }).click();
    await expect(page.getByText(`Reactivated ${name}'s login`)).toBeVisible();
    await signedInAs(them.page, login.email, login.password);
    await them.context.close();
    await api.deleteEmployee(person.id);
  });

  test('an admin resets a forgotten password, shown once', async ({ page, request }) => {
    const api = await apiAs(request, admin);
    const person = await api.createEmployee({
      firstName: 'Forgot',
      lastName: `Ful${unique()}`,
      managerId: null,
    });
    await activateLogin(request, person.login, 'about to be forgotten');
    const name = `${person.firstName} ${person.lastName}`;

    await signIn(page, admin);
    await openAccessMenu(page, name);
    await page.getByRole('menuitem', { name: 'Reset password' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Issue password' }).click();
    await expect(page.getByRole('heading', { name: 'New one-time password' })).toBeVisible();
    await expect(page.getByLabel('One-time password', { exact: true })).toHaveText(
      /^[A-Za-z2-9]{16}$/,
    );
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(
      'Has a one-time password',
    );
    await api.deleteEmployee(person.id);
  });

  test("an admin can't change their own access", async ({ page }) => {
    await signIn(page, admin, '/users');
    await expect(page.getByRole('button', { name: `Access for ${admin.name}` })).toBeDisabled();
  });

  test('anyone can change their own password from the account menu', async ({ page, request }) => {
    const api = await apiAs(request, admin);
    const person = await api.createEmployee({
      firstName: 'Self',
      lastName: `Serve${unique()}`,
      managerId: null,
    });
    const login = await activateLogin(request, person.login, 'first chosen phrase');

    await signedInAs(page, login.email, login.password);
    await page.getByRole('button', { name: new RegExp(login.email) }).click();
    await page.getByRole('menuitem', { name: 'Change password' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Current password').fill('wrong current one');
    await dialog.getByLabel('New password', { exact: true }).fill('second chosen phrase');
    await dialog.getByLabel('Confirm new password').fill('second chosen phrase');
    await dialog.getByRole('button', { name: 'Change password' }).click();
    await expect(dialog.getByText('Your current password is not right.')).toBeVisible();

    await dialog.getByLabel('Current password').fill(login.password);
    await dialog.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Your password has been changed.')).toBeVisible();
    // Still signed in here.
    await page.goto('/employees');
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    await api.deleteEmployee(person.id);
  });

  test('account changes appear in the audit trail, attributed to the admin', async ({
    page,
    request,
  }) => {
    const api = await apiAs(request, admin);
    const person = await api.createEmployee({
      firstName: 'Audit',
      lastName: `Ed${unique()}`,
      managerId: null,
    });
    await signIn(page, admin, '/audit');
    await page.getByRole('tab', { name: 'Account changes' }).click();
    const row = page.getByRole('row', { name: new RegExp(person.login.email) }).first();
    await expect(row).toContainText('Login created');
    await expect(row).toContainText(admin.email);
    await api.deleteEmployee(person.id);
  });

  test('a regular user cannot reach the Users page', async ({ page }) => {
    await signIn(page, viewer, '/users');
    await expect(page.getByRole('heading', { name: 'Managing users is for admins' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  });
});
