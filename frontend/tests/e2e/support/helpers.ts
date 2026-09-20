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

type Headers = Record<string, string>;

/** A team of a series and the chapters it published there, by chapter number. */
export interface PublishingTeam {
  id: string;
  name: string;
  chapterIds: Record<string, string>;
}

async function givenIAmThePublisher(request: APIRequestContext): Promise<Headers> {
  const { accessToken } = await data<{ accessToken: string }>(await request.post(`${API_URL}/auth/login`, { data: PUBLISHER }));
  return { Authorization: `Bearer ${accessToken}` };
}

/** A new series; the API creates its first team with it, led by the publisher. */
async function createSeries(request: APIRequestContext, headers: Headers, facts?: object): Promise<{ workId: string; title: string; team: PublishingTeam }> {
  const title = `E2E Series ${uniqueSuffix()}`;
  const work = await data<{ id: string }>(
    await request.post(`${API_URL}/works`, {
      headers,
      data: { title, synopsis: 'Created by the e2e suite.', type: 'MANGA', status: 'ONGOING', genres: ['Action'], facts }
    })
  );
  const projects = await data<{ teamId: string; teamName: string }[]>(await request.get(`${API_URL}/works/${work.id}/projects`, { headers }));
  return { workId: work.id, title, team: { id: projects[0].teamId, name: projects[0].teamName, chapterIds: {} } };
}

/** Publishes a two-page chapter of the series for one team (a chapter always belongs to a team). */
async function publishChapterFor(request: APIRequestContext, headers: Headers, workId: string, team: PublishingTeam, chapterNumber: string, title: string): Promise<string> {
  const pages = [];
  for (const pageNumber of [1, 2]) {
    const stored = await data<{ storageKey: string; cdnUrl: string }>(
      await request.post(`${API_URL}/storage/upload?folder=${encodeURIComponent(`scans/${workId}/${team.id}/c${chapterNumber}`)}`, {
        headers,
        multipart: { file: { name: `${pageNumber}.png`, mimeType: 'image/png', buffer: PAGE_PNG } }
      })
    );
    pages.push({ pageNumber, storageKey: stored.storageKey, cdnUrl: stored.cdnUrl, width: 1, height: 1 });
  }
  const chapter = await data<{ id: string }>(
    await request.post(`${API_URL}/works/${workId}/chapters/direct`, { headers, data: { teamId: team.id, chapterNumber, title, pages } })
  );
  team.chapterIds[chapterNumber] = chapter.id;
  return chapter.id;
}

/**
 * Creates a series with one published chapter of two pages through the API (as the publisher account), so reader
 * tests never depend on what an environment happens to contain.
 */
export async function publishChapter(request: APIRequestContext): Promise<{ workId: string; title: string; chapterId: string }> {
  const headers = await givenIAmThePublisher(request);
  const series = await createSeries(request, headers);
  const chapterId = await publishChapterFor(request, headers, series.workId, series.team, '1', 'The beginning');
  return { workId: series.workId, title: series.title, chapterId };
}

/** The facts `publishSeriesWithFacts` gives its series (US-04); the content rating is left out on purpose. */
export const E2E_FACTS = { alternativeTitles: ['Shin no Nakama', 'The True Companion'], artist: 'E2E Artist', releaseYear: 2019, originalLanguage: 'JAPANESE' };

/** A series created with `E2E_FACTS` and one published chapter, led by the publisher account (US-04). */
export async function publishSeriesWithFacts(request: APIRequestContext): Promise<{ workId: string; title: string }> {
  const headers = await givenIAmThePublisher(request);
  const series = await createSeries(request, headers, E2E_FACTS);
  await publishChapterFor(request, headers, series.workId, series.team, '1', 'The beginning');
  return { workId: series.workId, title: series.title };
}

/** Logs in through the UI as the publisher account: the leader of the team of every series the helpers create. */
export async function givenIAmLoggedInAsThePublisher(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(PUBLISHER.email);
  await page.getByLabel('Password').fill(PUBLISHER.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
}

/**
 * A series translated by two teams (US-12): the first team published chapters 1, 2 and 3, the second team, which
 * added the series to its own, chapters 1 and 2. So chapters 1 and 2 have two versions and chapter 3 only one.
 */
export async function publishSeriesByTwoTeams(request: APIRequestContext): Promise<{ workId: string; title: string; firstTeam: PublishingTeam; secondTeam: PublishingTeam }> {
  const headers = await givenIAmThePublisher(request);
  const series = await createSeries(request, headers);
  const created = await data<{ id: string; name: string }>(await request.post(`${API_URL}/teams`, { headers, data: { name: `E2E Team ${uniqueSuffix()}` } }));
  const secondTeam: PublishingTeam = { id: created.id, name: created.name, chapterIds: {} };
  await data(await request.post(`${API_URL}/teams/${secondTeam.id}/series`, { headers, data: { workId: series.workId } }));

  for (const chapterNumber of ['1', '2', '3']) {
    await publishChapterFor(request, headers, series.workId, series.team, chapterNumber, `Chapter ${chapterNumber}`);
  }
  for (const chapterNumber of ['1', '2']) {
    await publishChapterFor(request, headers, series.workId, secondTeam, chapterNumber, `Chapter ${chapterNumber}`);
  }
  return { workId: series.workId, title: series.title, firstTeam: series.team, secondTeam };
}
