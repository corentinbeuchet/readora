import { APIRequestContext, Page, expect } from '@playwright/test';
import { DataTable, createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Story } from '../story';
import { addSeriesToTeam, logIn, startATeam, thenTheFactIs, thenTheFactIsNotListed } from '../../support/helpers';

/** US-04 catalog: the genre filter, the facts of a series and the leader who edits them. */
const { Given, When, Then } = createBdd(test);

Given('the catalog has these series:', async ({ story }, table: DataTable) => {
  await givenTheCatalogHas(story, table.hashes());
});

Given(
  '{string} has the artist {string}, the year {int}, the language {word} and the other title {string}',
  async ({ story }, series: string, artist: string, year: number, language: string, otherTitle: string) => {
    story.remember('described series', series);
    await story.giveFacts(series, { artist, releaseYear: year, originalLanguage: language.toUpperCase(), alternativeTitles: [otherTitle] });
  }
);

Given('nobody filled in its content rating', async ({ story }) => {
  await givenNobodyRatedTheContentOf(story, story.recall('described series'));
});

Given('{string} leads a team that translates {string}', async ({ request, story }, leader: string, series: string) => {
  await givenIleadATeamOn(request, story, leader, series);
});

When('a reader clicks the {string} genre once', async ({ page, story }, genre: string) => {
  story.remember('genre', genre);
  await whenIOpenTheCatalog(page);
  await whenIClickTheGenre(page, genre);
});

When('he clicks it again', async ({ page, story }) => {
  await whenIClickTheGenre(page, story.recall('genre'));
});

When('he clicks it a third time', async ({ page, story }) => {
  await whenIClickTheGenre(page, story.recall('genre'));
});

When('she opens {string} for {string} in her team workspace and saves the artist {string}', async ({ page, story }, _link: string, series: string, artist: string) => {
  await logIn(page, story.actor());
  await whenIEditTheSeriesFromTheStudio(page, (await story.series(series)).title);
  await whenISaveTheArtist(page, artist);
});

Then('{string} is marked as wanted', async ({ page }, genre: string) => {
  await thenTheGenreIs(page, genre, 'wanted');
});

Then('{string} is marked as excluded', async ({ page }, genre: string) => {
  await thenTheGenreIs(page, genre, 'excluded');
});

Then('{string} is no longer used as a filter', async ({ page }, genre: string) => {
  await thenTheGenreIs(page, genre, 'not filtered');
});

Then('the page lists the artist, the year, the language and the other title', async ({ page, story }) => {
  const facts = story.facts(story.recall('described series'));
  await thenTheFactIs(page, 'Artist', [facts.artist!]);
  await thenTheFactIs(page, 'First published', [String(facts.releaseYear)]);
  await thenTheFactIs(page, 'Original language', [languageName(facts.originalLanguage!)]);
  await thenTheFactIs(page, 'Other titles', facts.alternativeTitles!);
});

Then('no content rating is shown', async ({ page }) => {
  await thenTheFactIsNotListed(page, 'Content rating');
});

Then('the series is saved with the artist {string} and she is back on the series page', async ({ page, story }, artist: string) => {
  await thenIAmOnTheSeriesPage(page, (await story.series(story.recall('edited series'))).workId);
  await thenTheFactIs(page, 'Artist', [artist]);
});

/** Each row is a new series, titled after the scenario's title (see `Story.title`). */
async function givenTheCatalogHas(story: Story, rows: Record<string, string>[]): Promise<void> {
  for (const row of rows) {
    await story.series(row['title'], {
      type: row['type'],
      status: row['status'],
      demographic: row['demographic'],
      author: row['author'],
      genres: row['genres'].split(',').map((genre) => genre.trim())
    });
  }
}

async function givenNobodyRatedTheContentOf(story: Story, series: string): Promise<void> {
  await story.giveFacts(series, { ...story.facts(series), contentRating: undefined });
}

/** A new reader starts a team, which adds the series: the leader of any team on a series may edit it. */
async function givenIleadATeamOn(request: APIRequestContext, story: Story, leader: string, series: string): Promise<void> {
  const account = await story.newReader(leader);
  const team = await startATeam(request, story.title('Team'), account);
  await addSeriesToTeam(request, { Authorization: `Bearer ${account.accessToken}` }, team.teamId, (await story.series(series)).workId);
  story.remember('edited series', series);
  story.follow(leader);
}

async function whenIOpenTheCatalog(page: Page): Promise<void> {
  await page.goto('/works');
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog' })).toBeVisible();
}

async function whenIClickTheGenre(page: Page, genre: string): Promise<void> {
  await page.getByRole('group', { name: 'Genres' }).getByRole('button', { name: new RegExp(`^${genre}: `) }).click();
}

async function whenIEditTheSeriesFromTheStudio(page: Page, title: string): Promise<void> {
  await page.goto('/scanlation');
  await page.getByRole('link', { name: new RegExp(`^Edit series\\s*: ${title}$`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edit series' })).toBeVisible();
}

async function whenISaveTheArtist(page: Page, artist: string): Promise<void> {
  await page.getByLabel('Artist').fill(artist);
  await page.getByRole('button', { name: 'Save the series' }).click();
}

/** The chip says its state in its name, and the filter is in the address (the catalog's single source of truth). */
async function thenTheGenreIs(page: Page, genre: string, state: 'wanted' | 'excluded' | 'not filtered'): Promise<void> {
  await expect(page.getByRole('group', { name: 'Genres' }).getByRole('button', { name: `${genre}: ${state}` })).toBeVisible();
  const param = { wanted: 'genre', excluded: 'excludeGenre', 'not filtered': undefined }[state];
  await expect.poll(() => [...new URL(page.url()).searchParams.entries()]).toEqual(param ? [[param, genre]] : []);
}

async function thenIAmOnTheSeriesPage(page: Page, workId: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/works/${workId}$`));
}

/** How the series page names a language code (`KOREAN` → "Korean"). */
function languageName(code: string): string {
  return code.charAt(0) + code.slice(1).toLowerCase();
}
