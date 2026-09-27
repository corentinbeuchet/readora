import { Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Story } from '../story';
import { PublishingTeam, thenIReadTheVersionBy, whenIChooseTheReadingMode, whenISwitchToTheVersionBy } from '../../support/helpers';
import {
  thenTheChapterAlsoOffersTheVersionBy,
  thenTheChapterIsListedOnce,
  thenTheChapterOpensTheVersionBy,
  thenTheChaptersListedAre,
  thenTheSeriesIsTranslatedBy,
  whenIChooseTheOrder,
  whenIFilterTheChaptersBy,
  whenIOpenTheChapter,
  whenIOpenTheSeries
} from '../../support/series-page';

/**
 * US-12 chapter versions: the series page and the reader. Readers ("Kenji", "a reader") are the browser, signed out:
 * the team a reader prefers lives in the browser.
 */
const { Given, When, Then } = createBdd(test);

Given('{string} published chapter(s) {chapters} of {string}', async ({ story }, team: string, chapters: number[], series: string) => {
  await givenTheTeamPublished(story, team, chapters, series);
});

Given('only {string} published chapter(s) {chapters} of {string}', async ({ story }, team: string, chapters: number[], series: string) => {
  await givenTheTeamPublished(story, team, chapters, series);
});

Given('{string} and {string} both published chapter(s) {chapters} of {string}', async ({ story }, first: string, second: string, chapters: number[], series: string) => {
  await givenTheTeamPublished(story, first, chapters, series);
  await givenTheTeamPublished(story, second, chapters, series);
});

Given(
  '{string} published chapters {chapters} of {string} and {string} only chapter {chapters}',
  async ({ story }, first: string, firstChapters: number[], series: string, second: string, secondChapters: number[]) => {
    await givenTheTeamPublished(story, first, firstChapters, series);
    await givenTheTeamPublished(story, second, secondChapters, series);
  }
);

Given('{string} published {int} chapters of {string} and {string} {int}', async ({ story }, first: string, firstCount: number, series: string, second: string, secondCount: number) => {
  await givenTheTeamPublished(story, first, upTo(firstCount), series);
  await givenTheTeamPublished(story, second, upTo(secondCount), series);
});

Given('{string} prefers {string} for {string}', async ({ page, story }, _reader: string, team: string, series: string) => {
  await givenIPreferTheTeamFor(page, await story.publishingTeam(team), await story.series(series));
});

Given('{string} reads chapter {int} of {string} by {string}', async ({ page, story }, _reader: string, chapter: number, _series: string, team: string) => {
  await givenIReadTheChapterBy(page, story.team(team), chapter);
});

When('a reader opens the series {string}', async ({ page, story }, series: string) => {
  await whenIOpenTheSeries(page, await story.series(series));
});

When('he opens the series {string}', async ({ page, story }, series: string) => {
  await whenIOpenTheSeries(page, await story.series(series));
});

When('a reader filters the chapters by {string}', async ({ page, story }, team: string) => {
  await whenIOpenTheSeries(page, story.theSeries());
  await whenIFilterTheChaptersBy(page, story.team(team));
});

When('a reader chooses {string} on the series {string}', async ({ page, story }, order: string, series: string) => {
  await whenIOpenTheSeries(page, await story.series(series));
  await whenIChooseTheOrder(page, order);
});

When('he switches to the version by {string}', async ({ page, story }, team: string) => {
  await whenISwitchToTheVersionBy(page, story.team(team));
});

When('he reaches the end of chapter {int}', async ({ page, story }, chapter: number) => {
  await whenIOpenTheSeries(page, story.theSeries());
  await whenIOpenTheChapter(page, chapter);
  await whenIChooseTheReadingMode(page, 'Vertical');
});

Then('the row of chapter {int} names the team {string}', async ({ page, story }, chapter: number, team: string) => {
  await thenTheChapterOpensTheVersionBy(page, chapter, story.team(team));
});

Then('chapter {int} appears once, by {string}, with a link to the version by {string}', async ({ page, story }, chapter: number, team: string, other: string) => {
  await thenTheChapterIsListedOnce(page, chapter);
  await thenTheChapterOpensTheVersionBy(page, chapter, story.team(team));
  await thenTheChapterAlsoOffersTheVersionBy(page, chapter, story.team(other));
});

Then('chapter {int} opens in the version by {string}, with a link to the version by {string}', async ({ page, story }, chapter: number, team: string, other: string) => {
  await thenTheChapterOpensTheVersionBy(page, chapter, story.team(team));
  await thenTheChapterAlsoOffersTheVersionBy(page, chapter, story.team(other));
});

Then('only chapter {int} is listed, in the version by {string}', async ({ page, story }, chapter: number, team: string) => {
  await thenTheChaptersListedAre(page, [chapter]);
  await thenTheChapterOpensTheVersionBy(page, chapter, story.team(team));
});

Then('the last chapter comes first', async ({ page, story }) => {
  await thenTheChaptersListedAre(page, newestFirst(story));
});

Then(
  '{string} lists {string} with {int} chapter(s) and {string} with {int} chapter(s), each linking to its team page',
  async ({ page, story }, _section: string, first: string, firstCount: number, second: string, secondCount: number) => {
    await thenTheSeriesIsTranslatedBy(page, story.team(first), chaptersText(firstCount));
    await thenTheSeriesIsTranslatedBy(page, story.team(second), chaptersText(secondCount));
  }
);

Then('{string} opens chapter {int} by {string}', async ({ page, story }, link: string, chapter: number, team: string) => {
  await whenIFollowTheLink(page, link);
  await thenIReadTheVersionBy(page, story.team(team), String(chapter));
});

async function givenTheTeamPublished(story: Story, team: string, chapters: number[], series: string): Promise<void> {
  await story.publishingTeam(team);
  await story.publish(team, series, chapters);
}

/** What `PreferredTeamStore` keeps when a reader picks a version on purpose, written before the app starts. */
async function givenIPreferTheTeamFor(page: Page, team: PublishingTeam, series: { workId: string }): Promise<void> {
  await page.addInitScript((choice) => localStorage.setItem('readora.reading.teams', JSON.stringify({ [choice.workId]: choice.teamId })), {
    workId: series.workId,
    teamId: team.id
  });
}

/** In vertical mode the end of the chapter, with its "Next chapter" link, is always on the page. */
async function givenIReadTheChapterBy(page: Page, team: PublishingTeam, chapterNumber: number): Promise<void> {
  await page.goto(`/read/${team.chapterIds[String(chapterNumber)]}`);
  await whenIChooseTheReadingMode(page, 'Vertical');
  await thenIReadTheVersionBy(page, team, String(chapterNumber));
}

async function whenIFollowTheLink(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name }).click();
}

function upTo(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function newestFirst(story: Story): number[] {
  return [...story.chapterNumbers(story.theSeriesName())].reverse();
}

/** The count as the series page writes it. */
function chaptersText(count: number): string {
  return count === 1 ? '1 chapter' : `${count} chapters`;
}
