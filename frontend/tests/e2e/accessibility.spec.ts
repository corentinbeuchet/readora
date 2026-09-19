import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/fixtures';
import { givenMyThemeIs, signUp } from './support/helpers';

/**
 * axe finds about half of the WCAG issues: this guards against regressions, a manual pass still matters.
 * Every scan runs in both themes: colours come from light-dark() tokens, so contrast differs per theme. The theme is
 * the reader's saved choice (the app is dark by default and does not follow the device unless asked to).
 */
for (const theme of ['light', 'dark'] as const) {
  test.describe(`Accessibility (axe, WCAG 2.2 AA, ${theme} theme)`, () => {
    test.beforeEach(async ({ page }) => {
      await givenMyThemeIs(page, theme);
    });

    for (const url of ['/', '/works', '/updates', '/rankings', '/lists', '/login', '/register', '/subscription']) {
      test(`${url} has no axe violations`, async ({ page, axe }) => {
        await whenIVisit(page, url);

        await thenAxeFindsNoViolations(axe());
      });
    }

    test('a work page and its reader have no axe violations', async ({ page, axe, publishedChapter }) => {
      await whenIVisit(page, `/works/${publishedChapter.workId}`);

      await thenAxeFindsNoViolations(axe());

      await whenIVisit(page, `/read/${publishedChapter.chapterId}`);

      await thenAxeFindsNoViolations(axe());

      await whenIOpenTheReaderSettings(page);

      await thenAxeFindsNoViolations(axe());
    });

    test('the signed-in header, account menu and notifications have no axe violations', async ({ page, axe }) => {
      await signUp(page, 'a11y');

      await thenAxeFindsNoViolations(axe());

      await whenIOpenTheAccountMenu(page);

      await thenAxeFindsNoViolations(axe());

      await page.keyboard.press('Escape');
      await whenIOpenTheNotifications(page);

      await thenAxeFindsNoViolations(axe());
    });
  });
}

async function whenIVisit(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('main h1').first()).toBeVisible();
}

async function whenIOpenTheReaderSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('region', { name: 'Reader settings' })).toBeVisible();
}

async function whenIOpenTheAccountMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
}

async function whenIOpenTheNotifications(page: Page): Promise<void> {
  await page.getByRole('button', { name: /notifications/i }).click();
  await expect(page.getByRole('region', { name: 'Notifications' })).toBeVisible();
}

async function thenAxeFindsNoViolations(scan: AxeBuilder): Promise<void> {
  const { violations } = await scan.analyze();
  expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
