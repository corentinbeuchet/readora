import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { PublishingTeam, thenNoNavigationLabelIsClipped } from './support/helpers';

const VIEWPORTS = [
  { name: 'small phone', width: 320, height: 640 },
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 }
];

const PUBLIC_PAGES = ['/', '/works', '/updates', '/rankings', '/lists', '/login', '/register'];

/** WCAG 1.4.10 reflow (no horizontal scrolling) and 2.5.8 target size, plus the two shapes of the navigation (US-14). */
test.describe('Responsive layout', () => {
  for (const viewport of VIEWPORTS) {
    test(`no page scrolls sideways on a ${viewport.name} (${viewport.width}px)`, async ({ page, publishedChapter }) => {
      await givenMyScreenIs(page, viewport);

      for (const url of [...PUBLIC_PAGES, `/works/${publishedChapter.workId}`]) {
        await whenIVisit(page, url);

        await thenThePageDoesNotScrollSideways(page, url);
      }

      await whenIOpenTheChapter(page, publishedChapter);

      await thenThePageDoesNotScrollSideways(page, 'the reader');
    });
  }

  test('a series translated by two teams fits a small phone, with chapter controls of at least 24px', async ({ page, seriesByTwoTeams }) => {
    await givenMyScreenIs(page, VIEWPORTS[0]);

    await whenIVisit(page, `/works/${seriesByTwoTeams.workId}`);

    await thenThePageDoesNotScrollSideways(page, 'the series page');
    await thenEveryControlIsAtLeast24px(page, 'app-chapter-list');

    await whenIOpenTheVersion(page, seriesByTwoTeams.firstTeam, '1');

    await thenThePageDoesNotScrollSideways(page, 'the reader');
    await thenEveryControlIsAtLeast24px(page, 'app-reader-toolbar');
  });

  test('on a phone the navigation is a tab bar at the bottom of the screen', async ({ page }) => {
    await givenMyScreenIs(page, VIEWPORTS[1]);
    await whenIVisit(page, '/works');

    await thenThereIsNoMenuButton(page);
    await thenTheNavigationIsAtTheBottomOfTheScreen(page);
    await thenTheNavigationShowsTheLink(page, 'Home');
    await thenEveryControlIsAtLeast24px(page, 'nav[aria-label="Primary"]');

    await whenIChooseTheLink(page, 'Rankings');

    await thenIAmOn(page, '/rankings');
    await thenTheNavigationShowsTheLink(page, 'Rankings');
  });

  test('on a small phone no tab label is cut', async ({ page }) => {
    await givenMyScreenIs(page, VIEWPORTS[0]);

    await whenIVisit(page, '/works');

    await thenNoNavigationLabelIsClipped(page, 'Primary');
  });

  test('from a tablet in landscape the navigation is in the header, and the logo is the way home', async ({ page }) => {
    await givenMyScreenIs(page, VIEWPORTS[3]);

    await whenIVisit(page, '/works');

    await thenThereIsNoMenuButton(page);
    await thenTheNavigationIsInTheHeader(page);
    await thenTheNavigationShowsTheLink(page, 'Rankings');
    await thenTheNavigationHidesTheLink(page, 'Home');
  });

  test('controls in the header and the reader toolbar are at least 24px on a phone', async ({ page, publishedChapter }) => {
    await givenMyScreenIs(page, VIEWPORTS[1]);

    await whenIOpenTheChapter(page, publishedChapter);

    await thenEveryControlIsAtLeast24px(page, 'header');
    await thenEveryControlIsAtLeast24px(page, 'app-reader-toolbar');
  });
});

async function givenMyScreenIs(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
}

async function whenIVisit(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('main h1').first()).toBeVisible();
}

/** Waits for the chapter itself: the reader shows a placeholder heading while the chapter loads. */
async function whenIOpenTheChapter(page: Page, chapter: { chapterId: string; workId: string }): Promise<void> {
  await page.goto(`/read/${chapter.chapterId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The beginning');
  await expect(page.getByRole('link', { name: /^Translated by/ }).or(page.locator(`a[href="/works/${chapter.workId}"]`)).first()).toBeVisible();
}

/** Waits for the links to the other teams' versions: they arrive with the chapter. */
async function whenIOpenTheVersion(page: Page, team: PublishingTeam, chapterNumber: string): Promise<void> {
  await page.goto(`/read/${team.chapterIds[chapterNumber]}`);
  await expect(page.getByRole('link', { name: /^Read this chapter by/ })).toBeVisible();
}

async function whenIChooseTheLink(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name }).click();
}

async function thenThePageDoesNotScrollSideways(page: Page, url: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), {
      message: `${url} is wider than the screen`,
      timeout: 5000
    })
    .toBeLessThanOrEqual(0);
}

/** The bar touches the bottom edge of the screen, whatever the page length. */
async function thenTheNavigationIsAtTheBottomOfTheScreen(page: Page): Promise<void> {
  await expect
    .poll(() => page.getByRole('navigation', { name: 'Primary' }).evaluate((nav) => Math.round(window.innerHeight - nav.getBoundingClientRect().bottom)), { timeout: 5000 })
    .toBe(0);
}

async function thenTheNavigationIsInTheHeader(page: Page): Promise<void> {
  await expect(page.getByRole('banner').getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect
    .poll(() => page.getByRole('navigation', { name: 'Primary' }).evaluate((nav) => Math.round(nav.getBoundingClientRect().top)), { timeout: 5000 })
    .toBeLessThan(80);
}

async function thenTheNavigationHidesTheLink(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name })).toBeHidden();
}

async function thenTheNavigationShowsTheLink(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name })).toBeVisible();
}

async function thenThereIsNoMenuButton(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
}

async function thenIAmOn(page: Page, path: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

/**
 * WCAG 2.5.8: visible buttons, links and form controls inside `container` are at least 24x24 CSS px. Polled (web-first)
 * so a measurement taken mid-layout is retried instead of failing the run.
 */
async function thenEveryControlIsAtLeast24px(page: Page, container: string): Promise<void> {
  await expect.poll(() => controlsSmallerThan24px(page, container), { timeout: 5000 }).toEqual([]);
}

function controlsSmallerThan24px(page: Page, container: string): Promise<string[]> {
  return page.locator(container).first().evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea'))
      .filter((el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'))
      .map((el) => ({ name: (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 30), box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 24 || box.height < 24)
      .map(({ name, box }) => `${name} ${Math.round(box.width)}x${Math.round(box.height)}`)
  );
}
