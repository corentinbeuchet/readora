import { test as base } from '@playwright/test';
import { publishChapter } from './helpers';

/**
 * Readora's `test`: Playwright fixtures are the "Given" step. A fixture only runs for the tests that ask for it, and
 * each test gets its own fresh data, so tests stay independent, parallel and retry-safe.
 */
export const test = base.extend<{
  /** A new series with one published two-page chapter, created through the API for this test only. */
  publishedChapter: Awaited<ReturnType<typeof publishChapter>>;
}>({
  publishedChapter: async ({ request }, use) => {
    await use(await publishChapter(request));
  }
});

export { expect } from '@playwright/test';
