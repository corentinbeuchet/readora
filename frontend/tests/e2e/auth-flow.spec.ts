import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { PASSWORD, thenTheAccountMenuHasNoTeamTools, uniqueSuffix } from './support/helpers';

interface Account {
  email: string;
  username: string;
  password: string;
}

/**
 * Full authentication journey against a running stack (frontend + backend).
 * Run locally with `docker compose up -d` (backend on :8080) and `npm start` (frontend on :4200).
 */
test.describe('Authentication flow', () => {
  test('register → profile visible → logout → login → session survives reload', async ({ page }) => {
    // This journey checks the register form itself, so it does not use the signUp() helper.
    const me = givenIAmANewVisitor();

    await whenIVisit(page, '/register');

    await thenICanSeeTheHeading(page, 'Create your account');

    await whenISubmitTheSignUpForm(page);

    await thenISeeTheText(page, 'Email is required');

    await whenIFillTheSignUpForm(page, me, { confirmation: 'does-not-match' });

    await thenISeeTheText(page, 'Passwords do not match');

    await whenIConfirmThePassword(page, me.password);
    await whenISubmitTheSignUpForm(page);

    await thenIAmOn(page, /\/profile$/);
    await thenMyProfileIsShownFor(page, me.username);
    await thenICanSeeTheTab(page, 'Overview');
    await thenMyDisplayNameIs(page, me.username);
    await thenTheAccountMenuHasNoTeamTools(page);

    await whenIOpenTheTab(page, 'Bookmarks');

    await thenISeeTheText(page, 'Bookmarks are a Premium feature');

    await whenIReload(page);

    await thenMyProfileIsShownFor(page, me.username);

    await whenILogOut(page);

    await thenICanLogIn(page);

    await whenIVisit(page, '/profile');

    await thenIAmOn(page, /\/login\?returnUrl=%2Fprofile/);

    await whenILogIn(page, { email: me.email, password: 'wrong-password' });

    await thenISeeTheAlert(page, /Invalid email or password/i);

    await whenIRetryWithThePassword(page, me.password);

    await thenIAmOn(page, /\/profile$/);
    await thenMyProfileIsShownFor(page, me.username);
  });

  test('anonymous visitors are redirected away from guarded routes', async ({ page }) => {
    await whenIVisit(page, '/scanlation/00000000-0000-0000-0000-000000000000');

    await thenIAmOn(page, /\/login\?returnUrl=/);

    await whenIVisit(page, '/subscription');

    await thenICanSeeTheHeading(page, 'Choose your plan');
    await thenICanSeeTheText(page, "Premium can't be bought yet");
  });
});

/** Credentials nobody has registered yet (called inside the test, so a retry gets fresh ones). */
function givenIAmANewVisitor(): Account {
  const suffix = uniqueSuffix();
  return { email: `e2e_${suffix}@readora.test`, username: `e2e_${suffix}`, password: PASSWORD };
}

async function whenIVisit(page: Page, url: string): Promise<void> {
  await page.goto(url);
}

async function whenIReload(page: Page): Promise<void> {
  await page.reload();
}

async function whenISubmitTheSignUpForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign up' }).click();
}

async function whenIFillTheSignUpForm(page: Page, account: Account, typed: { confirmation: string }): Promise<void> {
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Username').fill(account.username);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm password').fill(typed.confirmation);
}

async function whenIConfirmThePassword(page: Page, password: string): Promise<void> {
  await page.getByLabel('Confirm password').fill(password);
}

async function whenIOpenTheTab(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name }).click();
}

async function whenILogOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
}

async function whenILogIn(page: Page, credentials: { email: string; password: string }): Promise<void> {
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

async function whenIRetryWithThePassword(page: Page, password: string): Promise<void> {
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

async function thenIAmOn(page: Page, url: string | RegExp): Promise<void> {
  await expect(page).toHaveURL(url);
}

async function thenICanSeeTheText(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text)).toBeVisible();
}

async function thenICanSeeTheHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

async function thenISeeTheText(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text)).toBeVisible();
}

async function thenISeeTheAlert(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByRole('alert')).toContainText(text);
}

async function thenMyProfileIsShownFor(page: Page, username: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(username);
}

async function thenICanSeeTheTab(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('tab', { name })).toBeVisible();
}

async function thenMyDisplayNameIs(page: Page, displayName: string): Promise<void> {
  await expect(page.getByLabel('Display name')).toHaveValue(displayName);
}

async function thenICanLogIn(page: Page): Promise<void> {
  await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible();
}
