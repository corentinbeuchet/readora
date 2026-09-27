import { APIRequestContext, Browser, Locator, Page, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Story } from '../story';
import { MODERATOR, addToLibrary, givenIAmLoggedInAs, logIn, recordARead, registerAccount } from '../../support/helpers';

/** US-14 home and navigation. The desktop layout: the navigation sits in the header and the logo is the way home. */
const { Given, When, Then } = createBdd(test);

/** The team that publishes a series when the scenario doesn't say which. */
const ITS_TEAM = 'its team';

Given('a visitor sees no {string} entry in the navigation', async ({ page }, entry: string) => {
  await whenIOpen(page, '/');
  await thenTheNavigationHasNo(page, entry);
});

Given('reader {string} is signed in', async ({ page, story }, reader: string) => {
  await givenIAmSignedInAs(page, story, reader);
});

Given('at least five series were read this week', async ({ request, story }) => {
  await givenSeriesWereReadThisWeek(request, story, 5);
});

Given('reader {string} last read chapter {int} of {string} without finishing it', async ({ request, story }, reader: string, chapter: number, series: string) => {
  await givenIStoppedInTheMiddleOf(request, story, { reader, series, chapter });
});

Given('a new chapter of a series in the library of reader {string} is out', async ({ request, story }, reader: string) => {
  await givenNewChaptersInMyLibrary(request, story, { reader, series: 'a series', chapters: [1] });
});

Given('chapters {chapters} of {string} are new in the library of reader {string}', async ({ request, story }, chapters: number[], series: string, reader: string) => {
  await givenNewChaptersInMyLibrary(request, story, { reader, series, chapters });
});

When('a visitor opens Readora', async ({ page }) => {
  await whenIOpen(page, '/');
});

When('a visitor opens the home page', async ({ page }) => {
  await whenIOpen(page, '/');
});

When('reader {string} signs in', async ({ page, story }, reader: string) => {
  await givenIAmSignedInAs(page, story, reader);
});

When('they open the account menu', async ({ page }) => {
  await whenIOpenTheAccountMenu(page);
});

When('she opens the home page', async ({ page, story }) => {
  await logIn(page, story.actor());
  await whenIOpen(page, '/');
});

Then('the navigation offers {string}, {string}, {string}, {string} and {string}', async ({ page }, a: string, b: string, c: string, d: string, e: string) => {
  await thenTheNavigationOffers(page, [a, b, c, d, e]);
});

Then('the navigation offers {string}', async ({ page }, entry: string) => {
  await thenTheNavigationOffers(page, [entry]);
});

Then('each of them is a link, not an entry hidden behind a menu button', async ({ page }) => {
  await thenTheNavigationHasNoMenuButton(page);
});

Then('it offers {string}, since any reader can start or join a team', async ({ page }, entry: string) => {
  await thenTheAccountMenuOffers(page, entry);
});

Then('the navigation does not', async ({ page }) => {
  await thenTheNavigationHasNo(page, 'Studio');
});

Then("only a moderator's account menu also offers {string}", async ({ page, browser }, entry: string) => {
  await thenTheAccountMenuDoesNotOffer(page, entry);
  await thenTheAccountMenuOfTheModeratorOffers(browser, entry);
});

Then('the most read series of the week is featured with its cover', async ({ page }) => {
  await thenTheFirstOfTheWeekIsFeaturedWithItsCover(page);
});

Then('the next four follow as a numbered list with a link to the full ranking', async ({ page }) => {
  await thenTheNextOfTheWeekAreRanked(page, [2, 3, 4, 5]);
  await thenTheSectionLinksTo(page, 'Most read this week', '/rankings');
});

Then('{string} offers {string} with a link straight to chapter {int}', async ({ page, story }, section: string, series: string, chapter: number) => {
  await thenTheRailOffersTheChapter(page, section, (await story.series(series)).title, 'Continue', story.team(ITS_TEAM).chapterIds[String(chapter)]);
});

Then('{string} shows that chapter with a link to read it', async ({ page, story }, section: string) => {
  const [chapter] = story.chapterNumbers(story.theSeriesName());
  await thenTheRailOffersTheChapter(page, section, story.theSeries().title, 'Read', story.team(ITS_TEAM).chapterIds[String(chapter)]);
});

Then('{string} shows {string} once, marked {string}', async ({ page, story }, section: string, series: string, badge: string) => {
  await thenTheRailShowsTheSeriesOnceMarked(page, section, (await story.series(series)).title, badge);
});

Then('its link opens chapter {int}, the first she has not read', async ({ page, story }, chapter: number) => {
  await thenTheRailOffersTheChapter(page, 'New in your library', story.theSeries().title, 'Read', story.team(ITS_TEAM).chapterIds[String(chapter)]);
});

Then('a prompt to create a free account comes after the first sections, not before them', async ({ page }) => {
  await thenTheSignUpPromptComesAfter(page, ['Most read this week', 'Latest updates']);
});

Then('a signed-in reader does not see it', async ({ page, request }) => {
  await givenIAmSignedInAsANewReader(page, request);
  await whenIOpen(page, '/');
  await thenThereIsNoSignUpPrompt(page);
});

async function givenIAmSignedInAs(page: Page, story: Story, reader: string): Promise<void> {
  await story.newReader(reader);
  story.follow(reader);
  await logIn(page, story.account(reader));
}

async function givenIAmSignedInAsANewReader(page: Page, request: APIRequestContext): Promise<void> {
  await givenIAmLoggedInAs(page, await registerAccount(request, 'reader'));
}

/**
 * The ranking of the week is the whole site's: a new reader adds `count` new series to their library (activity that
 * counts), so at least that many series are ranked whatever else the environment holds.
 */
async function givenSeriesWereReadThisWeek(request: APIRequestContext, story: Story, count: number): Promise<void> {
  const reader = await registerAccount(request, 'weekly');
  for (let n = 1; n <= count; n++) {
    await addToLibrary(request, reader, (await story.series(`Weekly ${n}`)).workId);
  }
}

async function givenIStoppedInTheMiddleOf(request: APIRequestContext, story: Story, scenario: { reader: string; series: string; chapter: number }): Promise<void> {
  await story.publishingTeam(ITS_TEAM);
  await story.publish(ITS_TEAM, scenario.series, [scenario.chapter]);
  const reader = await story.newReader(scenario.reader);
  await recordARead(request, reader, story.team(ITS_TEAM).chapterIds[String(scenario.chapter)], false);
  story.follow(scenario.reader);
}

/** The series is in the reader's library before its chapters come out, and they have read none of them. */
async function givenNewChaptersInMyLibrary(request: APIRequestContext, story: Story, scenario: { reader: string; series: string; chapters: number[] }): Promise<void> {
  const reader = await story.newReader(scenario.reader);
  await addToLibrary(request, reader, (await story.series(scenario.series)).workId);
  await story.publishingTeam(ITS_TEAM);
  await story.publish(ITS_TEAM, scenario.series, scenario.chapters);
  story.follow(scenario.reader);
}

/** Opened once its heading is shown: a check that something is absent must not run on a page still loading. */
async function whenIOpen(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function whenIOpenTheAccountMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click();
}

function navigation(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Primary' });
}

/** On a wide screen the header's logo is the way home: the navigation has no "Home" link there (US-14 design). */
async function thenTheNavigationOffers(page: Page, entries: string[]): Promise<void> {
  for (const entry of entries) {
    const link = entry === 'Home' ? page.getByRole('link', { name: 'Readora home' }) : navigation(page).getByRole('link', { name: entry, exact: true });
    await expect(link).toBeVisible();
  }
}

async function thenTheNavigationHasNoMenuButton(page: Page): Promise<void> {
  await expect(navigation(page).getByRole('button')).toHaveCount(0);
}

async function thenTheNavigationHasNo(page: Page, entry: string): Promise<void> {
  await expect(navigation(page).getByRole('link', { name: entry, exact: true })).toHaveCount(0);
}

async function thenTheAccountMenuOffers(page: Page, entry: string): Promise<void> {
  await expect(page.getByRole('menuitem', { name: entry })).toBeVisible();
}

async function thenTheAccountMenuDoesNotOffer(page: Page, entry: string): Promise<void> {
  await expect(page.getByRole('menuitem', { name: entry })).toHaveCount(0);
}

/** The moderator (seed account) signs in in a browser of their own. */
async function thenTheAccountMenuOfTheModeratorOffers(browser: Browser, entry: string): Promise<void> {
  const context = await browser.newContext();
  const moderatorPage = await context.newPage();
  await logIn(moderatorPage, MODERATOR);
  await whenIOpenTheAccountMenu(moderatorPage);
  await thenTheAccountMenuOffers(moderatorPage, entry);
  await context.close();
}

function section(page: Page, heading: string): Locator {
  return page.getByRole('region', { name: heading });
}

/** The cover is decoration (no role): it is the section's `app-work-cover`, next to the rank and the title. */
async function thenTheFirstOfTheWeekIsFeaturedWithItsCover(page: Page): Promise<void> {
  const feature = section(page, 'Most read this week').getByRole('article').filter({ hasText: 'Rank 1' });
  await expect(feature.getByRole('heading', { level: 3 }).getByRole('link')).toBeVisible();
  await expect(feature.locator('app-work-cover')).toBeVisible();
}

async function thenTheNextOfTheWeekAreRanked(page: Page, ranks: number[]): Promise<void> {
  const rows = section(page, 'Most read this week').getByRole('listitem').filter({ has: page.getByRole('article') });
  await expect(rows).toHaveText(ranks.map((rank) => new RegExp(`^Rank ${rank}(?!\\d)`)));
}

async function thenTheSectionLinksTo(page: Page, heading: string, path: string): Promise<void> {
  await expect(section(page, heading).getByRole('link', { name: new RegExp(`^See all\\s*: ${heading}$`) })).toHaveAttribute('href', path);
}

function cardOf(page: Page, heading: string, title: string): Locator {
  return section(page, heading).getByRole('listitem').filter({ has: page.getByRole('link', { name: title, exact: true }) });
}

async function thenTheRailOffersTheChapter(page: Page, heading: string, title: string, action: string, chapterId: string): Promise<void> {
  await expect(cardOf(page, heading, title).getByRole('link', { name: action, exact: true })).toHaveAttribute('href', `/read/${chapterId}`);
}

async function thenTheRailShowsTheSeriesOnceMarked(page: Page, heading: string, title: string, badge: string): Promise<void> {
  await expect(cardOf(page, heading, title)).toHaveCount(1);
  await expect(cardOf(page, heading, title).getByText(badge)).toBeVisible();
}

/** Document order: what a screen reader and the keyboard reach first. */
async function thenTheSignUpPromptComesAfter(page: Page, headings: string[]): Promise<void> {
  const prompt = section(page, 'Pick up where you stopped');
  await expect(prompt).toBeVisible();
  for (const heading of headings) {
    const earlier = await section(page, heading).elementHandle();
    await expect.poll(() => prompt.evaluate((node, other) => Boolean(other!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING), earlier)).toBe(true);
  }
}

async function thenThereIsNoSignUpPrompt(page: Page): Promise<void> {
  await expect(section(page, 'Pick up where you stopped')).toHaveCount(0);
}
