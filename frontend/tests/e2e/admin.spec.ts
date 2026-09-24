import { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { API_URL, PASSWORD, RegisteredAccount, givenIAmLoggedInAsTheAdmin, registerAccount, signUp } from './support/helpers';

/** US-16 with the seed `admin` account, on readers created for each test. */
test.describe('Looking after accounts', () => {
  test('an admin suspends a reader, who cannot log in until let back in', async ({ page, request }) => {
    const reader = await givenAReader(request);
    await givenIAmLoggedInAsTheAdmin(page);

    await whenIOpenTheAccounts(page);
    await whenILookFor(page, reader.username);
    await whenIPress(page, `Suspend ${reader.username} for 7 days`);

    await thenTheAccountIsMarked(page, reader.username, 'Suspended until');
    await thenTheirLoginIsRefusedWith(request, reader, 'ACCOUNT_SUSPENDED');

    await whenIPress(page, `Let ${reader.username} back in`);

    await thenTheirLoginWorks(request, reader);
  });

  test('a reader is refused the accounts page', async ({ page }) => {
    await signUp(page, 'reader');

    await whenIOpenTheAccounts(page);

    await expect(page).toHaveURL(/\/forbidden/);
  });
});

async function givenAReader(request: APIRequestContext): Promise<RegisteredAccount> {
  return registerAccount(request, 'kept');
}

async function whenIOpenTheAccounts(page: Page): Promise<void> {
  await page.goto('/admin');
}

async function whenILookFor(page: Page, text: string): Promise<void> {
  await page.getByLabel('Find an account').fill(text);
}

async function whenIPress(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name }).click();
}

async function thenTheAccountIsMarked(page: Page, username: string, text: string): Promise<void> {
  await expect(page.getByRole('listitem').filter({ hasText: `@${username}` })).toContainText(text);
}

async function thenTheirLoginIsRefusedWith(request: APIRequestContext, reader: RegisteredAccount, code: string): Promise<void> {
  const response = await request.post(`${API_URL}/auth/login`, { data: { email: reader.email, password: PASSWORD } });
  expect(response.status()).toBe(403);
  expect(((await response.json()) as { code: string }).code).toBe(code);
}

async function thenTheirLoginWorks(request: APIRequestContext, reader: RegisteredAccount): Promise<void> {
  await expect(async () => {
    const response = await request.post(`${API_URL}/auth/login`, { data: { email: reader.email, password: PASSWORD } });
    expect(response.ok()).toBe(true);
  }).toPass({ timeout: 5_000 });
}
