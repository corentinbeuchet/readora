import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';

/** Model for e2e tests: fixtures create the data, given/when/then methods drive and check the page (frontend-e2e-tests skill). */
test.describe('Reader Experience & Viewer Suite', () => {
  test('home shows the public layout, the weekly ranking and the latest updates', async ({ page, publishedChapter }) => {
    await givenAChapterWasPublished(publishedChapter);

    await whenIVisit(page, '/');

    await thenICanSeeTheSiteHeader(page);
    await thenICanSeeTheHeading(page, 'Read manga, manhwa and comics');
    await thenICanSeeTheHeading(page, 'Most read this week');
    await thenICanSeeTheHeading(page, 'Latest updates');
    await thenICanLogIn(page);
  });

  test('the catalog is one tap from the home page', async ({ page }) => {
    await whenIVisit(page, '/');

    await whenIChooseInTheNavigation(page, 'Browse');

    await thenIAmOn(page, /\/works$/);
    await thenICanSeeTheHeading(page, 'Catalog');
  });

  test('legacy /read redirects to the catalog', async ({ page }) => {
    await whenIVisit(page, '/read');

    await thenIAmOn(page, /\/works$/);
  });

  test('unknown chapter renders an error state instead of crashing', async ({ page }) => {
    await whenIVisit(page, '/read/00000000-0000-0000-0000-000000000000');

    await thenICanSeeTheHeading(page, 'Chapter unavailable');
    await thenISeeTheAlert(page, "This chapter doesn't exist.");
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

/** The fixture published it: the latest updates of the home page have at least this chapter. */
async function givenAChapterWasPublished(chapter: { chapterId: string }): Promise<void> {
  expect(chapter.chapterId).toBeTruthy();
}

async function whenIChooseInTheNavigation(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name }).click();
}

/** The primary navigation is always shown: in the header on a computer, as a tab bar on a phone. */
async function thenICanSeeTheSiteHeader(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Readora home' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
}

async function thenICanSeeTheHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

async function thenICanLogIn(page: Page): Promise<void> {
  await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible();
}

async function thenIAmOn(page: Page, url: string | RegExp): Promise<void> {
  await expect(page).toHaveURL(url);
}

async function thenISeeTheAlert(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('alert')).toContainText(text);
}

async function thenICanBrowseTheCatalog(page: Page): Promise<void> {
  await expect(page.getByRole('main').getByRole('link', { name: 'Browse the catalog' })).toBeVisible();
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
