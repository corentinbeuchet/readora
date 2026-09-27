import { Page, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Account } from '../story';
import { DEPLOYED_URL, FRENCH_URL } from '../../support/sites';
import { whenIOpenTheSeries } from '../../support/series-page';
import { joinedAt } from '../../support/helpers';

/**
 * US-13 languages. The French site is its own build: `/fr/` when deployed, the French dev server locally (see
 * `support/sites.ts`), so its pages are opened by absolute URL.
 */
const { Given, When, Then } = createBdd(test);

Given('reader {string} is on the English page of the series {string}', async ({ page, story }, _reader: string, series: string) => {
  await whenIOpenTheSeries(page, await story.series(series));
});

Given('reader {string} uses the French site', async ({ page, story }, reader: string) => {
  await story.newReader(reader);
  story.follow(reader);
  await whenIOpenTheFrenchPage(page, 'login');
});

When('reader {string} opens her profile on the French site', async ({ page, story }, reader: string) => {
  await story.newReader(reader);
  story.follow(reader);
  await givenIAmLoggedInOnTheFrenchSite(page, story.account(reader));
  await whenIOpenTheFrenchPage(page, 'profile');
});

When('they choose {string} in the footer', async ({ page }, language: string) => {
  await whenIChooseTheLanguage(page, language);
});

When('the server refuses a request with the code {string}', async ({ page, story }, _code: string) => {
  await whenILogInOnTheFrenchSiteWith(page, { email: story.actor().email, password: 'not-my-password' });
});

Then('the first tab reads {string}', async ({ page }, label: string) => {
  await thenTheSelectedTabIs(page, label);
});

Then('her join date reads {string} and the day she joined, as in {string}', async ({ page, request, story }, words: string, _example: string) => {
  await thenTheJoinDateReads(page, `${words} ${frenchDate(await joinedAt(request, story.actor().username!))}`);
});

Then('they are on the French page of the series {string}', async ({ page, story }, series: string) => {
  await thenThePageIsInFrench(page);
  await thenIAmOnThePageOf(page, new URL(`works/${(await story.series(series)).workId}`, FRENCH_URL).href, (await story.series(series)).title);
});

Then('they see {string}', async ({ page }, text: string) => {
  await thenISeeTheAlert(page, text);
});

async function givenIAmLoggedInOnTheFrenchSite(page: Page, account: Account): Promise<void> {
  await whenIOpenTheFrenchPage(page, 'login');
  await whenILogInOnTheFrenchSiteWith(page, account);
  await expect(page.getByRole('button', { name: 'Menu du compte' })).toBeVisible();
}

async function whenIOpenTheFrenchPage(page: Page, path: string): Promise<void> {
  await page.goto(new URL(path, FRENCH_URL).href);
}

async function whenILogInOnTheFrenchSiteWith(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.getByLabel('E-mail').fill(account.email);
  await page.getByLabel('Mot de passe').fill(account.password);
  await page.getByRole('main').getByRole('button', { name: 'Se connecter' }).click();
}

/**
 * The footer's link leads to `/fr/…` of the same page. Deployed, that is the French build; locally the French build
 * is its own dev server, so the same path is opened there.
 */
async function whenIChooseTheLanguage(page: Page, language: string): Promise<void> {
  const link = page.getByRole('contentinfo').getByRole('link', { name: language });
  const path = new URL((await link.getAttribute('href'))!, page.url()).pathname;
  await link.click();
  if (!DEPLOYED_URL) {
    await page.goto(new URL(path.replace(/^\/fr\//, ''), FRENCH_URL).href);
  }
}

/** The first tab is the one shown when the page opens. */
async function thenTheSelectedTabIs(page: Page, label: string): Promise<void> {
  await expect(page.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
}

async function thenTheJoinDateReads(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

async function thenThePageIsInFrench(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
}

/** The series page: its address, and its title as the main heading. */
async function thenIAmOnThePageOf(page: Page, url: string, title: string): Promise<void> {
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
}

async function thenISeeTheAlert(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible();
}

/** How the French build writes a date (`mediumDate`: "1 janv. 2026"), in the browser's time zone like the page. */
function frenchDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
