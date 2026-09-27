import { APIRequestContext, Page, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Story } from '../story';
import { PUBLISHER, logIn, teamsWorkingOn } from '../../support/helpers';
import {
  givenIAmCreatingANewSeries,
  givenIAmInTheUploadStudio,
  givenIAmPublishingIntoTheSeriesFor,
  thenIAmToldReadoraAlreadyHas,
  thenTheChapterIsOutAsTheVersionOf,
  whenIDescribeTheSeries,
  whenIGoOnTo,
  whenIPublishChapterWithOnePage,
  whenIPublishIntoTheSeriesFor,
  whenISearchTheCatalogFor,
  whenITypeTheChapterNumber
} from '../../support/upload-studio';

/**
 * US-12 upload studio. A scanlator who publishes is the publisher account, which leads both e2e teams (see `Story`):
 * a new team's first chapter would wait for a moderator.
 */
const { Given, When, Then } = createBdd(test);

Given('{string} is in the catalog', async ({ story }, series: string) => {
  await story.series(series);
});

Given('{string} is already translated by the team {string}', async ({ story }, series: string, team: string) => {
  await story.publishingTeam(team);
  await story.teamWorksOn(team, series);
});

Given('scanlator {string} leads the team {string}', async ({ story }, scanlator: string, team: string) => {
  await givenTheScanlatorLeads(story, scanlator, team);
});

Given('scanlator {string} leads the team {string}, which works on {string}', async ({ story }, scanlator: string, team: string, series: string) => {
  await givenTheScanlatorLeads(story, scanlator, team);
  await story.teamWorksOn(team, series);
});

When('scanlator {string} opens the upload studio and searches for {string}', async ({ page, story }, scanlator: string, text: string) => {
  await givenIAmInTheUploadStudioAsAScanlator(page, story, scanlator);
  await whenISearchTheCatalogFor(page, story.title(text));
});

When('scanlator {string} types the title {string} for a new series', async ({ page, story }, scanlator: string, title: string) => {
  await givenIAmInTheUploadStudioAsAScanlator(page, story, scanlator);
  await givenIAmCreatingANewSeries(page);
  await whenIDescribeTheSeries(page, { title: story.title(title) });
});

When('{string} picks {string} in the upload studio for {string}', async ({ page, story }, _scanlator: string, series: string, team: string) => {
  await givenIAmInTheUploadStudioAsThePublisher(page);
  await whenISearchTheCatalogFor(page, (await story.series(series)).title);
  await whenIPublishIntoTheSeriesFor(page, (await story.series(series)).title, story.team(team).name);
});

When('{string} sets up chapter {int} of {string} in the upload studio', async ({ page, story }, scanlator: string, chapter: number, series: string) => {
  await logIn(page, PUBLISHER);
  await givenIAmPublishingIntoTheSeriesFor(page, await story.series(series), story.team(story.teamLedBy(scanlator)).id);
  await whenIGoOnTo(page, 'Next: Chapter Setup');
  await whenITypeTheChapterNumber(page, String(chapter));
});

Then('she sees {string} among the results', async ({ page, story }, series: string) => {
  await thenTheResultsInclude(page, (await story.series(series)).title);
});

Then('she can choose to create a new series instead', async ({ page }) => {
  await thenICanCreateANewSeries(page);
});

Then('{string} is added to {string}', async ({ request, story }, series: string, team: string) => {
  await thenTheTeamWorksOn(request, story.team(team).id, (await story.series(series)).workId);
});

Then('she publishes the chapter into {string} as the version of {string}', async ({ page, story }, series: string, team: string) => {
  const chapter = String(nextChapterNumber(story, series));
  await whenIPublishChapterWithOnePage(page, chapter);
  await thenTheChapterIsOutAsTheVersionOf(page, chapter, (await story.series(series)).title, story.team(team).name);
});

Then('she is told Readora already has {string}', async ({ page, story }, series: string) => {
  await thenIAmToldReadoraAlreadyHas(page, (await story.series(series)).title);
});

Then('she is told she adds the version of {string}', async ({ page, story }, team: string) => {
  await thenIAmToldIAddTheVersionOf(page, story.team(team).name);
});

Then('that {string} already published chapter {int}', async ({ page, story }, team: string, _chapter: number) => {
  await thenTheOtherVersionsAre(page, [story.team(team).name]);
});

async function givenTheScanlatorLeads(story: Story, scanlator: string, team: string): Promise<void> {
  await story.publishingTeam(team);
  story.isThePublisher(scanlator);
  story.leads(scanlator, team);
  story.follow(scanlator);
}

async function givenIAmInTheUploadStudioAsAScanlator(page: Page, story: Story, scanlator: string): Promise<void> {
  story.isThePublisher(scanlator);
  await givenIAmInTheUploadStudioAsThePublisher(page);
}

async function givenIAmInTheUploadStudioAsThePublisher(page: Page): Promise<void> {
  await logIn(page, PUBLISHER);
  await givenIAmInTheUploadStudio(page);
}

async function thenTheResultsInclude(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('list').getByRole('link', { name: title, exact: true })).toBeVisible();
}

async function thenICanCreateANewSeries(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Create a new series' })).toBeEnabled();
}

/** The studio added the series to the team on the server, not only on the page. */
async function thenTheTeamWorksOn(request: APIRequestContext, teamId: string, workId: string): Promise<void> {
  await expect.poll(() => teamsWorkingOn(request, workId)).toContain(teamId);
}

async function thenIAmToldIAddTheVersionOf(page: Page, teamName: string): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: `You are adding the version of ${teamName}.` })).toBeVisible();
}

async function thenTheOtherVersionsAre(page: Page, teamNames: string[]): Promise<void> {
  const versions = page.getByRole('status').filter({ hasText: 'Already published by other teams' });
  await expect(versions.getByRole('listitem')).toHaveText(teamNames);
}

function nextChapterNumber(story: Story, series: string): number {
  return Math.max(0, ...story.chapterNumbers(series)) + 1;
}
