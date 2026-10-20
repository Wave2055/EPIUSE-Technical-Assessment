import { admin, expect, signIn, test, unique, viewer } from './fixtures';

test.describe('home screen tasks', () => {
  test('adds a task, ticks it off, and keeps it ticked after a reload', async ({ page }) => {
    const title = `Check the backups ${unique()}`;
    await signIn(page, admin);
    await page.getByLabel('New task', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    // Not optimistic: the box ticks once the API has saved it.
    const box = page.getByRole('checkbox', { name: `Mark "${title}" as done` });
    await box.click();
    await expect(box).toBeChecked();

    await page.reload();
    await expect(page.getByRole('checkbox', { name: `Mark "${title}" as done` })).toBeChecked();
  });

  test('a manager gives a direct report a task, which the report sees', async ({
    page,
    browser,
  }) => {
    const title = `Prepare the sprint demo ${unique()}`;
    await signIn(page, admin);
    await page.getByRole('tab', { name: /Team tasks/ }).click();
    await page.getByLabel(`New task for ${viewer.name}`).fill(title);
    await page.getByLabel(`New task for ${viewer.name}`).press('Enter');
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('From you').first()).toBeVisible();

    // The report, in their own browser session.
    const context = await browser.newContext({
      extraHTTPHeaders: { 'X-E2E-Client': `e2e-report-${unique()}` },
    });
    const reportPage = await context.newPage();
    await signIn(reportPage, viewer);
    const item = reportPage.getByRole('listitem').filter({ hasText: title });
    await expect(item).toContainText(`From ${admin.name}`);
    const box = reportPage.getByRole('checkbox', { name: `Mark "${title}" as done` });
    await box.click();
    await expect(box).toBeChecked();
    await context.close();
  });

  test("keeps a report's own list read-only for their manager", async ({ page }) => {
    await signIn(page, admin);
    await page.getByRole('tab', { name: /Team tasks/ }).click();
    await expect(page.getByText('One-on-ones with Johan and Zanele')).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: /One-on-ones with Johan and Zanele/ }),
    ).toBeDisabled();
  });
});
