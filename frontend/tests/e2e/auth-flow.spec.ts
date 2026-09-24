import { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { PASSWORD, RegisteredAccount, registerAccount, resetLinkSentTo, thenTheAccountMenuOffersTeamToolsButNotModeration, uniqueSuffix } from './support/helpers';

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
    await thenTheAccountMenuOffersTeamToolsButNotModeration(page);

    await whenIOpenTheTab(page, 'Bookmarks');

    await thenISeeTheText(page, 'You have no bookmarks yet.');

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

  test('a reader changes the password and logs in with the new one only (US-15)', async ({ page }) => {
    const me = await givenIHaveSignedUp(page);

    await whenIOpenTheTab(page, 'Account');
    await whenIChangeMyPassword(page, { from: me.password, to: 'An0ther-Secret!' });

    await thenISeeTheText(page, 'Password changed. Your other devices are signed out.');

    await whenILogOut(page);
    await whenIVisit(page, '/login');
    await whenILogIn(page, { email: me.email, password: me.password });

    await thenISeeTheAlert(page, /invalid email or password/i);

    await whenIRetryWithThePassword(page, 'An0ther-Secret!');

    await thenIAmSignedIn(page);
  });

  test('a reader who forgot the password gets a link by email and chooses a new one (US-15)', async ({ page, request }) => {
    const me = await givenIHaveAnAccount(request);

    await whenIVisit(page, '/login');
    await whenIAskForAResetLinkFor(page, me.email);

    await thenISeeTheText(page, 'a link to choose a new password is on its way');

    await whenIOpenTheLinkFromMyInbox(page, request, me.email);
    await whenIChooseTheNewPassword(page, 'An0ther-Secret!');

    await thenISeeTheText(page, 'Your password is changed.');

    await whenIVisit(page, '/login');
    await whenILogIn(page, { email: me.email, password: 'An0ther-Secret!' });

    await thenIAmSignedIn(page);
  });

  test('a reader deletes the account and can no longer log in (US-15)', async ({ page }) => {
    const me = await givenIHaveSignedUp(page);

    await whenIOpenTheTab(page, 'Account');
    await whenIDeleteMyAccount(page, me.password);

    await thenIAmOn(page, '/');
    await thenICanLogIn(page);

    await whenIVisit(page, '/login');
    await whenILogIn(page, { email: me.email, password: me.password });

    await thenISeeTheAlert(page, /invalid email or password/i);
  });

  test('anonymous visitors are redirected away from guarded routes', async ({ page }) => {
    await whenIVisit(page, '/scanlation/00000000-0000-0000-0000-000000000000');

    await thenIAmOn(page, /\/login\?returnUrl=/);
  });
});

/** Credentials nobody has registered yet (called inside the test, so a retry gets fresh ones). */
function givenIAmANewVisitor(): Account {
  const suffix = uniqueSuffix();
  return { email: `e2e_${suffix}@readora.test`, username: `e2e_${suffix}`, password: PASSWORD };
}

/** Signs up through the form and lands on the profile page. */
async function givenIHaveSignedUp(page: Page): Promise<Account> {
  const me = givenIAmANewVisitor();
  await whenIVisit(page, '/register');
  await whenIFillTheSignUpForm(page, me, { confirmation: me.password });
  await whenISubmitTheSignUpForm(page);
  await thenMyProfileIsShownFor(page, me.username);
  return me;
}

async function givenIHaveAnAccount(request: APIRequestContext): Promise<RegisteredAccount> {
  return registerAccount(request);
}

async function whenIAskForAResetLinkFor(page: Page, email: string): Promise<void> {
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  // The login page has an Email field too: type only once the new page is there.
  await expect(page.getByRole('heading', { name: 'Forgot your password' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send me a link' }).click();
}

async function whenIOpenTheLinkFromMyInbox(page: Page, request: APIRequestContext, email: string): Promise<void> {
  await page.goto(await resetLinkSentTo(request, email));
}

async function whenIChooseTheNewPassword(page: Page, password: string): Promise<void> {
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByLabel('Confirm the new password').fill(password);
  await page.getByRole('button', { name: 'Save the new password' }).click();
}

async function whenIDeleteMyAccount(page: Page, password: string): Promise<void> {
  await page.getByRole('button', { name: 'Delete my account…' }).click();
  await page.getByLabel('Your password').fill(password);
  await page.getByRole('button', { name: 'Delete my account for good' }).click();
}

async function whenIChangeMyPassword(page: Page, passwords: { from: string; to: string }): Promise<void> {
  await page.getByLabel('Current password').fill(passwords.from);
  await page.getByLabel('New password', { exact: true }).fill(passwords.to);
  await page.getByLabel('Confirm the new password').fill(passwords.to);
  await page.getByRole('button', { name: 'Change password' }).click();
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

async function thenICanSeeTheHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

async function thenISeeTheText(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text)).toBeVisible();
}

async function thenIAmSignedIn(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
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
