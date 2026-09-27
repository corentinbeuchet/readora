import { APIRequestContext, Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { Story, test } from '../fixtures';
import { PublishingTeam, publishSeriesByTwoTeams, thenIReadTheVersionBy, whenIChooseTheReadingMode, whenISwitchToTheVersionBy } from '../../support/helpers';

/** US-12 chapter versions. The reader ("Kenji") is the browser, signed out: the team they prefer lives in the browser. */
const { Given, When, Then } = createBdd(test);

Given(
  '{string} and {string} both published chapters {int} and {int} of {string}',
  async ({ request, story }, firstTeam: string, secondTeam: string, first: number, second: number, series: string) => {
    await givenBothTeamsPublished(request, story, { series, teams: [firstTeam, secondTeam], chapters: [String(first), String(second)] });
  }
);

Given('{string} reads chapter {int} of {string} by {string}', async ({ page, story }, _reader: string, chapter: number, _series: string, team: string) => {
  await givenIReadTheChapterBy(page, story.team(team), String(chapter));
});

When('he switches to the version by {string}', async ({ page, story }, team: string) => {
  await whenISwitchToTheVersionBy(page, story.team(team));
});

Then('{string} opens chapter {int} by {string}', async ({ page, story }, link: string, chapter: number, team: string) => {
  await whenIFollowTheLink(page, link);
  await thenIReadTheVersionBy(page, story.team(team), String(chapter));
});

/** A fresh series stands for the scenario's one, and the two e2e teams for its two teams. */
async function givenBothTeamsPublished(
  request: APIRequestContext,
  story: Story,
  scenario: { series: string; teams: [string, string]; chapters: string[] }
): Promise<void> {
  const published = await publishSeriesByTwoTeams(request, { first: scenario.chapters, second: scenario.chapters });
  story.addSeries(scenario.series, published);
  story.addTeam(scenario.teams[0], published.firstTeam);
  story.addTeam(scenario.teams[1], published.secondTeam);
}

/** In vertical mode the end of the chapter, with its "Next chapter" link, is always on the page. */
async function givenIReadTheChapterBy(page: Page, team: PublishingTeam, chapterNumber: string): Promise<void> {
  await page.goto(`/read/${team.chapterIds[chapterNumber]}`);
  await whenIChooseTheReadingMode(page, 'Vertical');
  await thenIReadTheVersionBy(page, team, chapterNumber);
}

async function whenIFollowTheLink(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name }).click();
}
