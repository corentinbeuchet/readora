import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';

const VIEWPORTS = [
  { name: 'small phone', width: 320, height: 640 },
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 }
];

const PUBLIC_PAGES = ['/', '/works', '/updates', '/rankings', '/lists', '/login', '/register', '/subscription'];

/** WCAG 1.4.10 reflow (no horizontal scrolling) and 2.5.8 target size, plus the small-screen header. */
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

  test('on a phone the navigation hides behind the Menu button', async ({ page }) => {
    await givenMyScreenIs(page, VIEWPORTS[1]);
    await whenIVisit(page, '/works');

    await thenTheNavigationIsHidden(page);

    await whenIOpenTheMenu(page);

    await thenTheNavigationShowsTheLink(page, 'Rankings');

    await whenIChooseTheLink(page, 'Rankings');

    await thenIAmOn(page, '/rankings');
    await thenTheNavigationIsHidden(page);
  });

  test('from a tablet in landscape the navigation is always shown', async ({ page }) => {
    await givenMyScreenIs(page, VIEWPORTS[3]);

    await whenIVisit(page, '/works');

    await thenThereIsNoMenuButton(page);
    await thenTheNavigationShowsTheLink(page, 'Rankings');
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
  await expect(page.getByRole('link', { name: 'Translation team' }).or(page.locator(`a[href="/works/${chapter.workId}"]`)).first()).toBeVisible();
}

async function whenIOpenTheMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menu' }).click();
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

async function thenTheNavigationIsHidden(page: Page): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
}

async function thenTheNavigationShowsTheLink(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name })).toBeVisible();
}

async function thenThereIsNoMenuButton(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
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
