import { test, expect } from '@playwright/test';
import { publishChapter } from './support/helpers';

test.describe('Reader Experience & Viewer Suite', () => {
  test('home shows the catalog and the public layout', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Readora home' })).toBeVisible();
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

    await expect(page.getByRole('alert')).toContainText('Chapter unavailable');
    await expect(page.getByRole('link', { name: 'Browse the catalog' })).toBeVisible();
  });

  test('a published chapter can be read and switched to paged mode', async ({ page, request }) => {
    // The test publishes its own chapter: it never depends on (or skips for) what the environment contains.
    const { workId, title } = await publishChapter(request);

    await page.goto(`/works/${workId}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
    await page.getByRole('link', { name: /Ch\. 1/ }).click();
    await expect(page).toHaveURL(/\/read\//);

    const verticalBtn = page.getByRole('button', { name: 'Vertical' });
    const pagedBtn = page.getByRole('button', { name: 'Paged' });
    await expect(verticalBtn).toBeVisible();
    await expect(pagedBtn).toBeVisible();

    await pagedBtn.click();
    await expect(pagedBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('img', { name: /Page 1/ })).toBeVisible();

    // Anonymous readers get the Premium upsell instead of progress sync.
    await expect(page.getByText(/Go Premium/)).toBeVisible();
  });
});
