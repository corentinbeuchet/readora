import { Locator, Page } from '@playwright/test';
import { test as base, expect } from './support/fixtures';
import { givenIAmLoggedInAs, signUp, thenTheAccountMenuOffersTeamToolsButNotModeration } from './support/helpers';

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
