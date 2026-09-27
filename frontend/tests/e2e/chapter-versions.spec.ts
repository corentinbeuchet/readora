import { Page } from '@playwright/test';
import { test } from './support/fixtures';
import { thenTheChapterOpensTheVersionBy, thenTheChaptersListedAre, whenIFilterTheChaptersBy, whenIOpenTheSeries } from './support/series-page';

/**
 * US-12: several teams translate the same series. The scenarios of US-12 run in the browser (`@e2e`); this spec keeps
 * what they don't say. The fixture's first team published chapters 1 to 3, the second 1 and 2.
 */
test.describe('A series translated by several teams', () => {
  test('the team filter of the chapter list survives a reload', async ({ page, seriesByTwoTeams }) => {
    await whenIOpenTheSeries(page, seriesByTwoTeams);
    await whenIFilterTheChaptersBy(page, seriesByTwoTeams.secondTeam);

    await whenIReloadThePage(page);

    await thenTheChaptersListedAre(page, [1, 2]);
    await thenTheChapterOpensTheVersionBy(page, 1, seriesByTwoTeams.secondTeam);
  });
});

async function whenIReloadThePage(page: Page): Promise<void> {
  await page.reload();
}
