import { test, expect } from '@playwright/test';

test.describe('Reader Experience & Viewer Suite', () => {
  test('home shows the catalog and the public layout', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.logo-text')).toHaveText('Readora');
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('legacy /read redirects to the catalog', async ({ page }) => {
    await page.goto('/read');
    await expect(page).toHaveURL(/\/works$/);
  });

  test('unknown chapter renders an error state instead of crashing', async ({ page }) => {
    await page.goto('/read/00000000-0000-0000-0000-000000000000');

    await expect(page.locator('.viewer-container')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Chapter unavailable');
    await expect(page.getByRole('link', { name: 'Browse the catalog' })).toBeVisible();
  });

  test('a published chapter can be read and switched to paged mode', async ({ page }) => {
    await page.goto('/works');
    const firstWork = page.locator('.work-link').first();
    test.skip((await firstWork.count()) === 0, 'No works published in this environment');

    await firstWork.click();
    const firstChapter = page.locator('.chapter-link').first();
    test.skip((await firstChapter.count()) === 0, 'No published chapters in this environment');

    await firstChapter.click();
    await expect(page.locator('.viewer-container')).toBeVisible();

    const verticalBtn = page.getByRole('button', { name: 'Vertical' });
    const pagedBtn = page.getByRole('button', { name: 'Paged' });
    await expect(verticalBtn).toBeVisible();
    await expect(pagedBtn).toBeVisible();

    await pagedBtn.click();
    await expect(pagedBtn).toHaveClass(/active/);
    await expect(page.locator('img.active-page')).toBeVisible();

    // Anonymous readers get the Premium upsell instead of progress sync.
    await expect(page.locator('.sync-hint')).toContainText('Go Premium');
  });
});
