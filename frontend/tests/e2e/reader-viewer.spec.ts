import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';

/** Model for e2e tests: fixtures create the data, given/when/then methods drive and check the page (frontend-e2e-tests skill). */
test.describe('Reader Experience & Viewer Suite', () => {
  test('home shows the catalog and the public layout', async ({ page }) => {
    await whenIVisit(page, '/');

    await thenICanSeeTheSiteHeader(page);
    await thenICanSeeTheHeading(page, 'Catalog');
    await thenICanLogIn(page);
  });

  test('legacy /read redirects to the catalog', async ({ page }) => {
    await whenIVisit(page, '/read');

    await thenIAmOn(page, /\/works$/);
  });

  test('unknown chapter renders an error state instead of crashing', async ({ page }) => {
    await whenIVisit(page, '/read/00000000-0000-0000-0000-000000000000');

    await thenISeeTheAlert(page, 'Chapter unavailable');
    await thenICanBrowseTheCatalog(page);
  });

  test('a published chapter can be read and switched to paged mode', async ({ page, publishedChapter }) => {
    await givenIAmOnTheSeriesPage(page, publishedChapter);

    await whenIOpenChapter(page, 1);
    await whenIChooseTheReadingMode(page, 'Paged');

    await thenIAmOn(page, `/read/${publishedChapter.chapterId}`);
    await thenTheReadingModeIs(page, 'Paged');
    await thenICanSeePage(page, 1);
    await thenIAmOfferedPremiumToSaveMyProgress(page);
  });
});

async function givenIAmOnTheSeriesPage(page: Page, series: { workId: string; title: string }): Promise<void> {
  await page.goto(`/works/${series.workId}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(series.title);
}

async function whenIVisit(page: Page, url: string): Promise<void> {
  await page.goto(url);
}

async function whenIOpenChapter(page: Page, chapterNumber: number): Promise<void> {
  await page.getByRole('link', { name: new RegExp(`Ch\\. ${chapterNumber}\\b`) }).click();
}

async function whenIChooseTheReadingMode(page: Page, mode: 'Vertical' | 'Paged'): Promise<void> {
  await page.getByRole('button', { name: mode }).click();
}

/** On phones and portrait tablets the primary navigation sits behind the "Menu" button. */
async function thenICanSeeTheSiteHeader(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Readora home' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' }).or(page.getByRole('button', { name: 'Menu' }))).toBeVisible();
}

async function thenICanSeeTheHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

async function thenICanLogIn(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
}

async function thenIAmOn(page: Page, url: string | RegExp): Promise<void> {
  await expect(page).toHaveURL(url);
}

async function thenISeeTheAlert(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('alert')).toContainText(text);
}

async function thenICanBrowseTheCatalog(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Browse the catalog' })).toBeVisible();
}

async function thenTheReadingModeIs(page: Page, mode: 'Vertical' | 'Paged'): Promise<void> {
  const other = mode === 'Paged' ? 'Vertical' : 'Paged';
  await expect(page.getByRole('button', { name: mode })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: other })).toHaveAttribute('aria-pressed', 'false');
}

async function thenICanSeePage(page: Page, pageNumber: number): Promise<void> {
  await expect(page.getByRole('img', { name: new RegExp(`^Page ${pageNumber}\\b`) })).toBeVisible();
}

/** Anonymous readers get the Premium upsell instead of progress sync. */
async function thenIAmOfferedPremiumToSaveMyProgress(page: Page): Promise<void> {
  await expect(page.getByText(/Go Premium/)).toBeVisible();
}
