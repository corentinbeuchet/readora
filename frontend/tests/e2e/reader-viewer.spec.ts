import { test, expect } from './support/fixtures';

/** Given/When/Then model for e2e tests (see the frontend-e2e-tests skill): fixtures are the Given. */
test.describe('Reader Experience & Viewer Suite', () => {
  test('home shows the catalog and the public layout', async ({ page }) => {
    // When
    await page.goto('/');

    // Then
    await expect(page.getByRole('link', { name: 'Readora home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('legacy /read redirects to the catalog', async ({ page }) => {
    // When
    await page.goto('/read');

    // Then
    await expect(page).toHaveURL(/\/works$/);
  });

  test('unknown chapter renders an error state instead of crashing', async ({ page }) => {
    // When
    await page.goto('/read/00000000-0000-0000-0000-000000000000');

    // Then
    await expect(page.getByRole('alert')).toContainText('Chapter unavailable');
    await expect(page.getByRole('link', { name: 'Browse the catalog' })).toBeVisible();
  });

  test('a published chapter can be read and switched to paged mode', async ({ page, publishedChapter }) => {
    // Given a series with one chapter, published for this test (never depends on what the environment contains)
    await page.goto(`/works/${publishedChapter.workId}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(publishedChapter.title);

    // When
    await page.getByRole('link', { name: /Ch\. 1/ }).click();
    await page.getByRole('button', { name: 'Paged' }).click();

    // Then
    await expect(page).toHaveURL(`/read/${publishedChapter.chapterId}`);
    await expect(page.getByRole('button', { name: 'Paged' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Vertical' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('img', { name: /Page 1/ })).toBeVisible();
    // Anonymous readers get the Premium upsell instead of progress sync.
    await expect(page.getByText(/Go Premium/)).toBeVisible();
  });
});
