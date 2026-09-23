import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/fixtures';
import { PublishingTeam, givenIAmLoggedInAsThePublisher, givenMyThemeIs, signUp } from './support/helpers';

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

    for (const url of ['/', '/works', '/updates', '/rankings', '/lists', '/login', '/register']) {
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

    test('a series translated by two teams and the reader of one version have no axe violations', async ({ page, axe, seriesByTwoTeams }) => {
      await whenIVisit(page, `/works/${seriesByTwoTeams.workId}`);

      await thenAxeFindsNoViolations(axe());

      await whenIOpenTheVersion(page, seriesByTwoTeams.firstTeam, '1');

      await thenAxeFindsNoViolations(axe());
    });

    test('a series with facts and the form that edits them have no axe violations', async ({ page, axe, seriesWithFacts }) => {
      await whenIVisit(page, `/works/${seriesWithFacts.workId}`);

      await thenAxeFindsNoViolations(axe());

      await givenIAmLoggedInAsThePublisher(page);
      await whenIVisit(page, `/scanlation/series/${seriesWithFacts.workId}`);
      await whenISaveAYearThatIsNotAYear(page);

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

/** Waits for the links to the other teams' versions: they arrive with the chapter. */
async function whenIOpenTheVersion(page: Page, team: PublishingTeam, chapterNumber: string): Promise<void> {
  await page.goto(`/read/${team.chapterIds[chapterNumber]}`);
  await expect(page.getByRole('link', { name: /^Read this chapter by/ })).toBeVisible();
}

/** The form is scanned with an error showing: the state with the most ARIA in it. */
async function whenISaveAYearThatIsNotAYear(page: Page): Promise<void> {
  await page.getByLabel('First published (year)').fill('19');
  await page.getByRole('button', { name: 'Save the series' }).click();
  await expect(page.getByLabel('First published (year)')).toHaveAttribute('aria-invalid', 'true');
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
