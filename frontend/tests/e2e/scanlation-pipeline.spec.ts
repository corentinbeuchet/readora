import { test, expect } from '@playwright/test';

test.describe('Scanlation Collaborative Multi-Role Pipeline Suite', () => {
  test('the scanlation workspace is protected: anonymous users go to login', async ({ page }) => {
    await page.goto('/scanlation');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fscanlation/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('a plain reader is forbidden from the workspace and sees no Scanlation menu entry', async ({ page }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await page.goto('/register');
    await page.getByLabel('Email').fill(`reader_${suffix}@readora.test`);
    await page.getByLabel('Username').fill(`reader_${suffix}`);
    await page.getByLabel('Password', { exact: true }).fill('Sup3rSecret!');
    await page.getByLabel('Confirm password').fill('Sup3rSecret!');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/profile$/);

    await expect(page.getByRole('link', { name: 'Scanlation' })).toHaveCount(0);

    await page.goto('/scanlation/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  });

  test('two collaborators have isolated sessions (one browser context each)', async ({ browser }) => {
    // Multi-role work happens in parallel sessions: signing in one must never leak into another.
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const cleanerContext = await browser.newContext();
    const translatorContext = await browser.newContext();
    try {
      const cleaner = await cleanerContext.newPage();
      await cleaner.goto('/register');
      await cleaner.getByLabel('Email').fill(`cleaner_${suffix}@readora.test`);
      await cleaner.getByLabel('Username').fill(`cleaner_${suffix}`);
      await cleaner.getByLabel('Password', { exact: true }).fill('Sup3rSecret!');
      await cleaner.getByLabel('Confirm password').fill('Sup3rSecret!');
      await cleaner.getByRole('button', { name: 'Sign up' }).click();
      await expect(cleaner).toHaveURL(/\/profile$/);
      await expect(cleaner.getByRole('heading', { level: 1 })).toContainText(`cleaner_${suffix}`);

      const translator = await translatorContext.newPage();
      await translator.goto('/profile');
      await expect(translator).toHaveURL(/\/login\?returnUrl=%2Fprofile/);
      await expect(translator.getByRole('link', { name: 'Log in' })).toBeVisible();

      // The first session is unaffected by the second context.
      await cleaner.reload();
      await expect(cleaner.getByRole('heading', { level: 1 })).toContainText(`cleaner_${suffix}`);
    } finally {
      await cleanerContext.close();
      await translatorContext.close();
    }
  });
});
