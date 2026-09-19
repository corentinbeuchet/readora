import { Page } from '@playwright/test';
import { test as base, expect } from './support/fixtures';
import { signUp, thenTheAccountMenuHasNoTeamTools } from './support/helpers';

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

  test('a plain reader is forbidden from the workspace and sees no Scanlation menu entry', async ({ page }) => {
    await givenIAmSignedUpAs(page, 'reader');

    await thenTheAccountMenuHasNoTeamTools(page);

    await whenIVisit(page, '/scanlation/00000000-0000-0000-0000-000000000000');

    await thenIAmOn(page, /\/forbidden/);
    await thenICanSeeTheHeading(page, 'Access denied');
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

async function whenIReload(page: Page): Promise<void> {
  await page.reload();
}

async function thenIAmOn(page: Page, url: string | RegExp): Promise<void> {
  await expect(page).toHaveURL(url);
}

async function thenICanSeeTheHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

async function thenMyProfileIsShownFor(page: Page, username: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(username);
}

async function thenICanLogIn(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
}
