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

    await expect(page.getByRole('menuitem', { name: 'Scanlation' })).toHaveCount(0);

    await page.goto('/scanlation/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  });

  test('multi-role collaboration context simulation (two isolated sessions)', async ({ browser }) => {
    // Isolated Cleaner session
    const cleanerContext = await browser.newContext();
    const cleanerPage = await cleanerContext.newPage();
    await cleanerPage.goto('/');
    await expect(cleanerPage.locator('.logo-text')).toHaveText('Readora');

    // Isolated Translator session
    const translatorContext = await browser.newContext();
    const translatorPage = await translatorContext.newPage();
    await translatorPage.goto('/');
    await expect(translatorPage.locator('.logo-text')).toHaveText('Readora');

    await cleanerContext.close();
    await translatorContext.close();
  });
});
