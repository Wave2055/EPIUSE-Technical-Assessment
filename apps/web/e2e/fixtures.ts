import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Shared set-up for the end-to-end specs, which run against the full Docker stack
 * (`pnpm test:e2e:docker`, ADR-0035) or any deployment given E2E_BASE_URL.
 *
 * The seeded logins (apps/api/prisma/seed.ts): the admin is Pieter van Wyk, CTO, with
 * Aisha Patel and Ruan Pretorius reporting to him; the viewer is Aisha, with Johan Botha
 * and Zanele Khumalo reporting to her. Passwords come from the environment.
 */
export const admin = {
  email: 'admin@example.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? '',
  name: 'Pieter van Wyk',
};
export const viewer = {
  email: 'viewer@example.com',
  password: process.env.E2E_VIEWER_PASSWORD ?? '',
  name: 'Aisha Patel',
};
type Login = typeof admin;

/** Rate-limit counters live in the API's memory, so a rerun must not reuse a blocked id. */
const runId = Date.now().toString(36);

export const test = base.extend({
  // Each test is its own viewer as far as rate limiting goes, as separate people would be:
  // the stack's CloudFront stand-in forwards this as CloudFront-Viewer-Address.
  extraHTTPHeaders: async ({}, use, testInfo) => {
    await use({ 'X-E2E-Client': `e2e-${runId}-${testInfo.testId}-${testInfo.retry}` });
  },
});
export { expect };

test.beforeEach(() => {
  test.skip(!admin.password || !viewer.password, 'Set E2E_ADMIN_PASSWORD and E2E_VIEWER_PASSWORD.');
});

export async function signIn(page: Page, who: Login, path = '/') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  if (path !== '/') await page.goto(path);
}

/** A unique tag per call, so specs can rerun against the same database. */
export const unique = () => Math.random().toString(36).slice(2, 7);

/** An employee number unlikely to clash with the seed or another run. */
export const employeeNumber = () => `E-${String(Math.floor(2000 + Math.random() * 7999))}`;

/**
 * Talks to the API directly for set-up and clean-up, through the same edge as the browser.
 * Signs in once per test.
 */
export async function apiAs(request: APIRequestContext, who: Login) {
  const login = await request.post('/api/auth/login', {
    data: { email: who.email, password: who.password },
  });
  expect(login.ok()).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    async createEmployee(fields: {
      firstName: string;
      lastName: string;
      managerId: string | null;
    }) {
      const res = await request.post('/api/employees', {
        headers,
        data: {
          ...fields,
          employeeNumber: employeeNumber(),
          email: `${fields.firstName}.${fields.lastName}.${unique()}@example.com`.toLowerCase(),
          birthDate: '1990-05-05',
          salary: 400_000,
          position: 'E2E Fixture',
        },
      });
      expect(res.status(), await res.text()).toBe(201);
      return (await res.json()) as { id: string; managerId: string | null };
    },
    async employee(id: string) {
      const res = await request.get(`/api/employees/${id}`, { headers });
      return { status: res.status(), body: res.ok() ? await res.json() : null };
    },
    async findByNumber(number: string) {
      const res = await request.get(`/api/employees?q=${number}`, { headers });
      return ((await res.json()) as { items: { id: string; firstName: string }[] }).items[0];
    },
    async deleteEmployee(id: string) {
      await request.delete(`/api/employees/${id}`, { headers });
    },
  };
}

/** Picks a date in the form's calendar popover. */
export async function pickBirthDate(page: Page, year: string, month: string, label: RegExp) {
  await page.getByRole('dialog').getByRole('button', { name: 'Birth date' }).click();
  await page.getByRole('combobox', { name: /year/i }).selectOption(year);
  await page.getByRole('combobox', { name: /month/i }).selectOption({ label: month });
  await page.getByRole('button', { name: label }).click();
}
