import { Locator, Page } from '@playwright/test';
import { test as base, expect } from './support/fixtures';
import { TeamWithSeries, givenIAmLoggedInAs, signUp, thenTheAccountMenuOffersTeamToolsButNotModeration } from './support/helpers';

const test = base.extend<{
  /** A second, independent browser session (its own context: cookies and storage are not shared with `page`). */
  otherSession: Page;
}>({
  otherSession: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(await context.newPage());
    await context.close();
  }
});

test.describe('Scanlation Collaborative Multi-Role Pipeline Suite', () => {
  test('the scanlation workspace is protected: anonymous users go to login', async ({ page }) => {
    await whenIVisit(page, '/scanlation');

    await thenIAmOn(page, /\/login\?returnUrl=%2Fscanlation/);
    await thenICanSeeTheHeading(page, 'Log in');
  });

  test('a new reader finds the team tools, but no board of a team they are not on', async ({ page }) => {
    await givenIAmSignedUpAs(page, 'reader');

    await thenTheAccountMenuOffersTeamToolsButNotModeration(page);

    await whenIVisit(page, '/scanlation/00000000-0000-0000-0000-000000000000');

    await thenICanSeeTheHeading(page, 'Project unavailable');
  });

  test('the Studio shows what waits for me 20 at a time', async ({ page, busyLeader }) => {
    await givenIAmLoggedInAs(page, busyLeader.account);

    await whenIVisit(page, '/scanlation');

    await thenTheChaptersWaitingForMeAre(page, 20);
    await thenICanSee(page, 'Page 1 / 2');

    await whenIShowTheNextPageOfWhatWaits(page);

    await thenTheChaptersWaitingForMeAre(page, 1);
    await thenICanSee(page, `Chapter 21 of ${busyLeader.title}`);
    await thenICanSee(page, 'Page 2 / 2');
  });

  test("a task's pages load on the board when I open them", async ({ page, busyLeader }) => {
    await givenIAmLoggedInAs(page, busyLeader.account);

    await whenIVisit(page, `/scanlation/${busyLeader.projectId}`);
    await whenIOpenThePagesOfChapter(page, 21);

    await thenTheTaskOfChapterLinksToPage(page, 21, 1);
  });

  test("the Studio lists a team's series 20 at a time, and finds one by its title", async ({ page, teamWithManySeries }) => {
    await givenIAmLoggedInAs(page, teamWithManySeries.leader);

    await whenIVisit(page, '/scanlation');

    await thenTheSeriesListedForTheTeamAre(page, teamWithManySeries, 20);
    await thenICanSee(page, 'Page 1 / 2');

    await whenIFindTheSeries(page, teamWithManySeries, teamWithManySeries.titles[24]);

    await thenTheSeriesListedForTheTeamAre(page, teamWithManySeries, 1);
    await thenICanSee(page, '1 series matches');
  });

  test('two collaborators have isolated sessions (one browser context each)', async ({ page, otherSession }) => {
    const cleanerName = await givenIAmSignedUpAs(page, 'cleaner');

    await thenMyProfileIsShownFor(page, cleanerName);

    await whenIVisit(otherSession, '/profile');

    await thenIAmOn(otherSession, /\/login\?returnUrl=%2Fprofile/);
    await thenICanLogIn(otherSession);

    await whenIReload(page);

    await thenMyProfileIsShownFor(page, cleanerName);
  });
});

/** Signs up a fresh account named `<prefix>_…` and returns its username. */
async function givenIAmSignedUpAs(page: Page, prefix: string): Promise<string> {
  return signUp(page, prefix);
}

async function whenIVisit(page: Page, url: string): Promise<void> {
  await page.goto(url);
}

async function whenIShowTheNextPageOfWhatWaits(page: Page): Promise<void> {
  await whatWaitsForMe(page).getByRole('button', { name: 'Next' }).click();
}

function taskOfChapter(page: Page, chapter: number): Locator {
  return page.getByRole('article').filter({ has: page.getByText(`Chapter ${chapter}`, { exact: true }) });
}

async function whenIOpenThePagesOfChapter(page: Page, chapter: number): Promise<void> {
  await taskOfChapter(page, chapter).getByText('1 page', { exact: true }).click();
}

async function thenTheTaskOfChapterLinksToPage(page: Page, chapter: number, pageNumber: number): Promise<void> {
  await expect(taskOfChapter(page, chapter).getByRole('link', { name: `Page ${pageNumber}` })).toBeVisible();
}

function panelOf(page: Page, team: TeamWithSeries): Locator {
  return page.getByRole('article', { name: team.name });
}

async function whenIFindTheSeries(page: Page, team: TeamWithSeries, title: string): Promise<void> {
  await panelOf(page, team).getByLabel('Find a series by its title').fill(title);
}

async function thenTheSeriesListedForTheTeamAre(page: Page, team: TeamWithSeries, count: number): Promise<void> {
  await expect(panelOf(page, team).getByRole('link', { name: /^E2E Team Series / })).toHaveCount(count);
}

async function whenIReload(page: Page): Promise<void> {
  await page.reload();
}

async function thenIAmOn(page: Page, url: string | RegExp): Promise<void> {
  await expect(page).toHaveURL(url);
}

function whatWaitsForMe(page: Page): Locator {
  return page.getByRole('region', { name: 'Waiting for you' });
}

async function thenTheChaptersWaitingForMeAre(page: Page, count: number): Promise<void> {
  await expect(whatWaitsForMe(page).getByRole('listitem')).toHaveCount(count);
}

async function thenICanSee(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

async function thenICanSeeTheHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

async function thenMyProfileIsShownFor(page: Page, username: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(username);
}

/** On /login the header drops its own "Log in" link (no second link to the page you are on): the form is the way in. */
async function thenICanLogIn(page: Page): Promise<void> {
  await expect(page.getByRole('main').getByRole('button', { name: 'Log in' })).toBeVisible();
}
