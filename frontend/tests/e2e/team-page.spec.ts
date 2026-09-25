import { Locator, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { TeamWithSeries } from './support/helpers';

test.describe('Team page (US-12)', () => {
  test('a team page shows its series 24 at a time', async ({ page, teamWithManySeries }) => {
    await givenIAmOnTheTeamPage(page, teamWithManySeries);

    await thenTheSeriesCardsAre(page, 24);
    await thenICanSee(page, 'Page 1 / 2');

    await whenIGoToTheNextPageOfItsSeries(page);

    await thenTheUrlAsksForPage(page, 1);
    await thenTheSeriesCardsAre(page, 1);
    await thenICanSee(page, 'Page 2 / 2');
    await thenICanSeeTheHeading(page, teamWithManySeries.name);
  });
});

async function givenIAmOnTheTeamPage(page: Page, team: TeamWithSeries): Promise<void> {
  await page.goto(`/teams/${team.teamId}`);
}

async function whenIGoToTheNextPageOfItsSeries(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: "Pages of the team's series" }).getByRole('link', { name: 'Next' }).click();
}

function seriesSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Series' });
}

async function thenTheSeriesCardsAre(page: Page, count: number): Promise<void> {
  await expect(seriesSection(page).getByRole('listitem')).toHaveCount(count);
}

async function thenTheUrlAsksForPage(page: Page, index: number): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`[?&]page=${index}(&|$)`));
}

async function thenICanSee(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

async function thenICanSeeTheHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}
