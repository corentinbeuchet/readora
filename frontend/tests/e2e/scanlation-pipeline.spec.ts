import { test, expect } from '@playwright/test';
import { signUp } from './support/helpers';

test.describe('Scanlation Collaborative Multi-Role Pipeline Suite', () => {
  test('the scanlation workspace is protected: anonymous users go to login', async ({ page }) => {
    await page.goto('/scanlation');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fscanlation/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('a plain reader is forbidden from the workspace and sees no Scanlation menu entry', async ({ page }) => {
    await signUp(page, 'reader');

    await expect(page.getByRole('link', { name: 'Scanlation' })).toHaveCount(0);

    await page.goto('/scanlation/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  });

  test('two collaborators have isolated sessions (one browser context each)', async ({ browser }) => {
    // Multi-role work happens in parallel sessions: signing in one must never leak into another.
    const cleanerContext = await browser.newContext();
    const translatorContext = await browser.newContext();
    try {
      const cleaner = await cleanerContext.newPage();
      const cleanerName = await signUp(cleaner, 'cleaner');
      await expect(cleaner.getByRole('heading', { level: 1 })).toContainText(cleanerName);

      const translator = await translatorContext.newPage();
      await translator.goto('/profile');
      await expect(translator).toHaveURL(/\/login\?returnUrl=%2Fprofile/);
      await expect(translator.getByRole('link', { name: 'Log in' })).toBeVisible();

      // The first session is unaffected by the second context.
      await cleaner.reload();
      await expect(cleaner.getByRole('heading', { level: 1 })).toContainText(cleanerName);
    } finally {
      await cleanerContext.close();
      await translatorContext.close();
    }
  });
});
