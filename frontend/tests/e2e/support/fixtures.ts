import AxeBuilder from '@axe-core/playwright';
import { test as base } from '@playwright/test';
import { publishChapter, publishSeriesByTwoTeams, publishSeriesWithFacts } from './helpers';

/**
 * Readora's `test`: Playwright fixtures are the "Given" step. A fixture only runs for the tests that ask for it, and
 * each test gets its own fresh data, so tests stay independent, parallel and retry-safe.
 */
export const test = base.extend<{
  /** A new series with one published two-page chapter, created through the API for this test only. */
  publishedChapter: Awaited<ReturnType<typeof publishChapter>>;
  /** A new series translated by two teams (US-12): chapters 1 and 2 in two versions, chapter 3 by the first team only. */
  seriesByTwoTeams: Awaited<ReturnType<typeof publishSeriesByTwoTeams>>;
  /** A new series created with facts (US-04) and one published chapter; the publisher account leads its team. */
  seriesWithFacts: Awaited<ReturnType<typeof publishSeriesWithFacts>>;
  /** An axe scan of the current page against WCAG 2.0/2.1/2.2 A and AA (`await axe().analyze()`). */
  axe: () => AxeBuilder;
}>({
  /**
   * Playwright's WebKit for Windows crashes the page ("Page crashed") when the vertical scrollbar appears after the
   * first layout: a client-rendered page that is short while loading and grows past the screen once its data arrives
   * (`/works/:id`, `/teams/:id`; found by bisection, review-2026-09-19/R27). Safari has overlay scrollbars and no such
   * relayout, so the site is left alone: the `webkit` and `Mobile Safari` projects get the scrollbar from the start.
   */
  context: async ({ context, browserName }, use) => {
    if (browserName === 'webkit') {
      await context.addInitScript(() => {
        const keepTheScrollbar = (): void => {
          const style = document.createElement('style');
          style.textContent = 'html { overflow-y: scroll; }';
          document.documentElement.appendChild(style);
        };
        if (document.documentElement) {
          keepTheScrollbar();
        } else {
          new MutationObserver((_, observer) => {
            if (document.documentElement) {
              observer.disconnect();
              keepTheScrollbar();
            }
          }).observe(document, { childList: true });
        }
      });
    }
    await use(context);
  },
  publishedChapter: async ({ request }, use) => {
    await use(await publishChapter(request));
  },
  seriesByTwoTeams: async ({ request }, use) => {
    await use(await publishSeriesByTwoTeams(request));
  },
  seriesWithFacts: async ({ request }, use) => {
    await use(await publishSeriesWithFacts(request));
  },
  axe: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']));
  }
});

export { expect } from '@playwright/test';
