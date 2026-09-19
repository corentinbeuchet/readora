import { APIRequestContext, Page, expect } from '@playwright/test';

/** Backend API root; defaults to the local docker compose backend. */
export const API_URL = (process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');

/**
 * Account allowed to create series and publish chapters (`WORK_CREATE`). Defaults to the `admin` dev seed account
 * (Spring profile `local`, see AGENTS.md); against another environment set E2E_PUBLISHER_EMAIL / E2E_PUBLISHER_PASSWORD.
 */
const PUBLISHER = {
  email: process.env['E2E_PUBLISHER_EMAIL'] ?? 'admin@readora.local',
  password: process.env['E2E_PUBLISHER_PASSWORD'] ?? 'readora-dev'
};

export const PASSWORD = 'Sup3rSecret!';

/**
 * A unique suffix so parallel workers, retries and re-runs never collide on emails, usernames or titles. Call it
 * inside the test (not at describe scope), so a retry gets fresh data. Letters, digits and `_` only (usernames).
 */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * The reader's saved theme choice, written before the app starts (it is dark without one). Same key and JSON format
 * as `ThemeStore`; call it before the first `goto`.
 */
export async function givenMyThemeIs(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((choice) => localStorage.setItem('readora.theme', JSON.stringify(choice)), theme);
}

/**
 * No entry of the primary navigation (the phone tab bar) has its text cut: tabs are narrow, and French labels are
 * longer. Polled, so a measurement taken before the font arrives is retried.
 */
export async function thenNoNavigationLabelIsClipped(page: Page, navigationName: string): Promise<void> {
  const navigation = page.getByRole('navigation', { name: navigationName });
  await expect
    .poll(
      () =>
        navigation.evaluate((nav) =>
          Array.from(nav.querySelectorAll<HTMLElement>('a span'))
            .filter((label) => label.scrollWidth > label.clientWidth)
            .map((label) => label.textContent ?? '')
        ),
      { timeout: 5000 }
    )
    .toEqual([]);
}

/** Team tools (US-14) are entries of the account menu, for scanlators, uploaders and moderators only. */
export async function thenTheAccountMenuHasNoTeamTools(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Scanlation workspace' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Upload Studio' })).toHaveCount(0);
  await page.keyboard.press('Escape');
}

/** Signs up a fresh reader through the UI and waits for the profile page. Returns the username. */
export async function signUp(page: Page, prefix = 'e2e'): Promise<string> {
  const username = `${prefix}_${uniqueSuffix()}`;
  await page.goto('/register');
  await page.getByLabel('Email').fill(`${username}@readora.test`);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  return username;
}

async function data<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.ok(), `${response.url()} -> ${response.status()}: ${await response.text()}`).toBe(true);
  return ((await response.json()) as { data: T }).data;
}

/** 1×1 transparent PNG: the smallest page image the upload endpoint accepts. */
const PAGE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/**
 * Creates a series with one published chapter of two pages through the API (as the publisher account), so reader
 * tests never depend on what an environment happens to contain.
 */
export async function publishChapter(request: APIRequestContext): Promise<{ workId: string; title: string; chapterId: string }> {
  const { accessToken } = await data<{ accessToken: string }>(await request.post(`${API_URL}/auth/login`, { data: PUBLISHER }));
  const headers = { Authorization: `Bearer ${accessToken}` };

  const title = `E2E Series ${uniqueSuffix()}`;
  const work = await data<{ id: string }>(
    await request.post(`${API_URL}/works`, { headers, data: { title, synopsis: 'Created by the e2e suite.', type: 'MANGA', status: 'ONGOING', genres: ['Action'] } })
  );

  const pages = [];
  for (const pageNumber of [1, 2]) {
    const stored = await data<{ storageKey: string; cdnUrl: string }>(
      await request.post(`${API_URL}/storage/upload?folder=${encodeURIComponent(`scans/${work.id}/c1`)}`, {
        headers,
        multipart: { file: { name: `${pageNumber}.png`, mimeType: 'image/png', buffer: PAGE_PNG } }
      })
    );
    pages.push({ pageNumber, storageKey: stored.storageKey, cdnUrl: stored.cdnUrl, width: 1, height: 1 });
  }
  const chapter = await data<{ id: string }>(
    await request.post(`${API_URL}/works/${work.id}/chapters/direct`, { headers, data: { chapterNumber: '1', title: 'The beginning', pages } })
  );
  return { workId: work.id, title, chapterId: chapter.id };
}
