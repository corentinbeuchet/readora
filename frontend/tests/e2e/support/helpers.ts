import { APIRequestContext, Page, expect } from '@playwright/test';

/** Backend API root; defaults to the local docker compose backend. */
export const API_URL = (process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');

/**
 * Account that publishes the chapters tests read (any reader could, through a team). Defaults to the `admin` dev seed account
 * (Spring profile `local`, see AGENTS.md); against another environment set E2E_PUBLISHER_EMAIL / E2E_PUBLISHER_PASSWORD.
 */
export const PUBLISHER = {
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

/** Team tools (US-14) are entries of the account menu: every reader can start or join a team; Moderation is for moderators. */
export async function thenTheAccountMenuOffersTeamToolsButNotModeration(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Studio' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Moderation' })).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  return username;
}

async function data<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.ok(), `${response.url()} -> ${response.status()}: ${await response.text()}`).toBe(true);
  return ((await response.json()) as { data: T }).data;
}

/** 1×1 transparent PNG: the smallest page image the upload endpoint accepts. */
export const PAGE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

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

/**
 * The two teams the e2e series are published by, led by the publisher and reused by every test and run: a series
 * created without a team gets a new team of its own, which piled thousands of teams on the publisher account.
 */
export const E2E_TEAMS = { first: 'E2E Publishers', second: 'E2E Second Team' } as const;

/** Found or created once per worker (module state), then reused. */
const e2eTeams = new Map<string, Promise<{ id: string; name: string }>>();

async function e2eTeam(request: APIRequestContext, headers: Headers, name: string): Promise<{ id: string; name: string }> {
  let team = e2eTeams.get(name);
  if (!team) {
    team = findOrCreateTeam(request, headers, name);
    e2eTeams.set(name, team);
  }
  return team;
}

async function findOrCreateTeam(request: APIRequestContext, headers: Headers, name: string): Promise<{ id: string; name: string }> {
  const mine = async (): Promise<{ id: string; name: string } | undefined> =>
    (await data<{ id: string; name: string }[]>(await request.get(`${API_URL}/teams/mine`, { headers }))).find((team) => team.name === name);
  const existing = await mine();
  if (existing) {
    return existing;
  }
  const created = await request.post(`${API_URL}/teams`, { headers, data: { name } });
  if (created.ok()) {
    return data<{ id: string; name: string }>(created);
  }
  // Another worker created it in the meantime (the name is taken): it is one of mine now.
  const raced = await mine();
  expect(raced, `team "${name}" could not be created: ${created.status()} ${await created.text()}`).toBeDefined();
  return raced!;
}

/** The publisher leads the first e2e team, so the upload studio can create a series for it; returns its name. */
export async function givenThePublisherLeadsTheE2eTeam(request: APIRequestContext): Promise<string> {
  return (await e2eTeam(request, await givenIAmThePublisher(request), E2E_TEAMS.first)).name;
}

/** A new series, published by the first e2e team (its task board is created with it). */
async function createSeries(request: APIRequestContext, headers: Headers, facts?: object): Promise<{ workId: string; title: string; team: PublishingTeam }> {
  const title = `E2E Series ${uniqueSuffix()}`;
  const team = await e2eTeam(request, headers, E2E_TEAMS.first);
  const work = await data<{ id: string }>(
    await request.post(`${API_URL}/works`, {
      headers,
      data: { title, synopsis: 'Created by the e2e suite.', type: 'MANGA', status: 'ONGOING', genres: ['Action'], facts, teamId: team.id }
    })
  );
  return { workId: work.id, title, team: { id: team.id, name: team.name, chapterIds: {} } };
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

/**
 * A fact of the series page (US-04) and its values. A fact is a term of the description list: `dt` has the ARIA role
 * "term", `dd` "definition". `label` is the text of the running language ("Artist", "Dessin").
 */
export async function thenTheFactIs(page: Page, label: string, values: string[]): Promise<void> {
  const group = page.locator('dl > div').filter({ has: page.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) }) });
  await expect(group.getByRole('definition')).toHaveText(values);
}

/**
 * A series created with facts (US-04) and one published chapter, led by the publisher account. The content rating
 * is left out on purpose, and the first other title is unique, so a search for it finds this series only.
 */
export async function publishSeriesWithFacts(request: APIRequestContext): Promise<{ workId: string; title: string; otherTitles: string[] }> {
  const headers = await givenIAmThePublisher(request);
  const otherTitles = [`Shin no Nakama ${uniqueSuffix()}`, 'The True Companion'];
  const series = await createSeries(request, headers, { alternativeTitles: otherTitles, artist: 'E2E Artist', releaseYear: 2019, originalLanguage: 'JAPANESE' });
  await publishChapterFor(request, headers, series.workId, series.team, '1', 'The beginning');
  return { workId: series.workId, title: series.title, otherTitles };
}

/** Logs in through the UI as the publisher account: the leader of the team of every series the helpers create. */
export async function givenIAmLoggedInAsThePublisher(page: Page): Promise<void> {
  await logIn(page, PUBLISHER);
}

/**
 * Account with `COMMENT_MODERATE` (US-11). Defaults to the `moderator` dev seed account; against another environment
 * set E2E_MODERATOR_EMAIL / E2E_MODERATOR_PASSWORD.
 */
export const MODERATOR = {
  email: process.env['E2E_MODERATOR_EMAIL'] ?? 'moderator@readora.local',
  password: process.env['E2E_MODERATOR_PASSWORD'] ?? 'readora-dev'
};

/**
 * Account with `USER_MANAGE` (US-16). Defaults to the `admin` dev seed account; against another environment set
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 */
export const ADMIN = {
  email: process.env['E2E_ADMIN_EMAIL'] ?? 'admin@readora.local',
  password: process.env['E2E_ADMIN_PASSWORD'] ?? 'readora-dev'
};

/** Logs in through the UI as the admin account. */
export async function givenIAmLoggedInAsTheAdmin(page: Page): Promise<void> {
  await logIn(page, ADMIN);
}

/** Logs in through the UI as the moderator account. */
export async function givenIAmLoggedInAsTheModerator(page: Page): Promise<void> {
  await logIn(page, MODERATOR);
}

async function logIn(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
}

/** A comment of a published chapter, written by a reader created for the test. */
export interface PostedComment {
  workId: string;
  chapterId: string;
  commentId: string;
  author: string;
  content: string;
}

/**
 * Publishes a chapter and has a new reader (registered through the API) comment on it. The content is unique, so a
 * test can find this comment among others, e.g. in the moderation queue that every test shares.
 */
export async function publishCommentedChapter(request: APIRequestContext, options: { spoiler?: boolean } = {}): Promise<PostedComment> {
  const chapter = await publishChapter(request);
  const author = `commenter_${uniqueSuffix()}`;
  const { accessToken } = await data<{ accessToken: string }>(
    await request.post(`${API_URL}/auth/register`, { data: { email: `${author}@readora.test`, username: author, password: PASSWORD } })
  );
  const content = `A comment for the e2e suite ${uniqueSuffix()}`;
  const comment = await data<{ id: string }>(
    await request.post(`${API_URL}/comments/chapter/${chapter.chapterId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { content, isSpoiler: options.spoiler ?? false }
    })
  );
  return { workId: chapter.workId, chapterId: chapter.chapterId, commentId: comment.id, author, content };
}

/** A commented chapter whose comment the publisher account reported as spam, so it waits in the moderation queue. */
export async function publishReportedComment(request: APIRequestContext): Promise<PostedComment & { reportId: string }> {
  const comment = await publishCommentedChapter(request);
  const headers = await givenIAmThePublisher(request);
  const { reportId } = await data<{ reportId: string }>(
    await request.post(`${API_URL}/comments/${comment.commentId}/reports`, { headers, data: { reason: 'SPAM' } })
  );
  return { ...comment, reportId };
}

/**
 * Closes a report the test left open: the queue lists only the 100 oldest open reports, so reports left behind by
 * earlier runs would push the next runs' reports out of it. A report the test already hid or dismissed is refused (4xx).
 */
export async function dismissReportIfOpen(request: APIRequestContext, reportId: string): Promise<void> {
  const headers = await givenIAmThePublisher(request);
  const response = await request.post(`${API_URL}/moderation/reports/${reportId}/dismiss`, { headers });
  expect(response.status(), `dismiss ${reportId}: ${await response.text()}`).toBeLessThan(500);
}

/** Closes the open reports readers made on a comment during a test (reported through the UI, so no id is known). */
export async function dismissReportsOn(request: APIRequestContext, commentId: string): Promise<void> {
  const headers = await givenIAmThePublisher(request);
  const queue = await data<{ reportId: string; commentId: string }[]>(await request.get(`${API_URL}/moderation/reports`, { headers }));
  for (const item of queue.filter((report) => report.commentId === commentId)) {
    await dismissReportIfOpen(request, item.reportId);
  }
}

/** The comments anyone (signed out) is shown for a chapter. */
export async function visibleCommentsOf(request: APIRequestContext, chapterId: string): Promise<string[]> {
  const comments = await data<{ content: string }[]>(await request.get(`${API_URL}/comments/chapter/${chapterId}`));
  return comments.map((comment) => comment.content);
}

/**
 * A series translated by two teams (US-12): the first team published chapters 1, 2 and 3, the second team, which
 * added the series to its own, chapters 1 and 2. So chapters 1 and 2 have two versions and chapter 3 only one.
 */
export async function publishSeriesByTwoTeams(request: APIRequestContext): Promise<{ workId: string; title: string; firstTeam: PublishingTeam; secondTeam: PublishingTeam }> {
  const headers = await givenIAmThePublisher(request);
  const series = await createSeries(request, headers);
  const second = await e2eTeam(request, headers, E2E_TEAMS.second);
  const secondTeam: PublishingTeam = { id: second.id, name: second.name, chapterIds: {} };
  await data(await request.post(`${API_URL}/teams/${secondTeam.id}/series`, { headers, data: { workId: series.workId } }));

  for (const chapterNumber of ['1', '2', '3']) {
    await publishChapterFor(request, headers, series.workId, series.team, chapterNumber, `Chapter ${chapterNumber}`);
  }
  for (const chapterNumber of ['1', '2']) {
    await publishChapterFor(request, headers, series.workId, secondTeam, chapterNumber, `Chapter ${chapterNumber}`);
  }
  return { workId: series.workId, title: series.title, firstTeam: series.team, secondTeam };
}

/** A new team's first chapter (US-11): published by a reader created for the test, so it waits for a moderator. */
export interface ChapterForReview {
  workId: string;
  title: string;
  chapterId: string;
  teamName: string;
}

/**
 * A new reader starts a team, adds a series and publishes chapter 1 through the API: as the team's first chapter, it
 * waits in the moderation queue instead of reaching readers.
 */
export async function publishAFirstChapterForReview(request: APIRequestContext): Promise<ChapterForReview> {
  const { accessToken } = await registerAccount(request, 'newteam');
  const headers = { Authorization: `Bearer ${accessToken}` };
  const teamName = `New Team ${uniqueSuffix()}`;
  const team = await data<{ id: string }>(await request.post(`${API_URL}/teams`, { headers, data: { name: teamName } }));
  const title = `E2E First Chapter ${uniqueSuffix()}`;
  const work = await data<{ id: string }>(
    await request.post(`${API_URL}/works`, { headers, data: { title, synopsis: 'Created by the e2e suite.', type: 'MANGA', status: 'ONGOING', genres: ['Action'], teamId: team.id } })
  );
  const chapterId = await publishChapterFor(request, headers, work.id, { id: team.id, name: teamName, chapterIds: {} }, '1', 'The beginning');
  return { workId: work.id, title, chapterId, teamName };
}

/** Clean-up: a chapter a test left waiting goes back to its team, so the shared queue stays short. */
export async function sendBackIfWaiting(request: APIRequestContext, chapterId: string): Promise<void> {
  const headers = await givenIAmThePublisher(request);
  const response = await request.post(`${API_URL}/moderation/chapters/${chapterId}/send-back`, { headers });
  // 400 CHAPTER_NOT_WAITING when the test already decided: nothing to clean.
  expect(response.status(), `send back ${chapterId}: ${await response.text()}`).toBeLessThan(500);
}

/** Whether a reader (anonymous) can open the chapter. */
export async function chapterIsReadable(request: APIRequestContext, chapterId: string): Promise<boolean> {
  return (await request.get(`${API_URL}/chapters/${chapterId}`)).ok();
}

/** A reader account created through the API for one test (password `PASSWORD`). */
export interface RegisteredAccount {
  email: string;
  username: string;
  accessToken: string;
}

export async function registerAccount(request: APIRequestContext, prefix = 'e2e'): Promise<RegisteredAccount> {
  const username = `${prefix}_${uniqueSuffix()}`;
  const email = `${username}@readora.test`;
  const { accessToken } = await data<{ accessToken: string }>(
    await request.post(`${API_URL}/auth/register`, { data: { email, username, password: PASSWORD } })
  );
  return { email, username, accessToken };
}

/**
 * Mailpit, the dev inbox of the docker compose stack (US-15 emails); against another environment set E2E_MAILPIT_URL
 * to an inbox with the same API.
 */
export const MAILPIT_URL = (process.env['E2E_MAILPIT_URL'] ?? 'http://localhost:8025').replace(/\/+$/, '');

/** The path (with its query) of the reset link in the newest email to `email`, once it arrived. */
export async function resetLinkSentTo(request: APIRequestContext, email: string): Promise<string> {
  let link: string | undefined;
  await expect(async () => {
    const found = (await (await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:"${email}"` } })).json()) as {
      messages: { ID: string }[];
    };
    expect(found.messages.length).toBeGreaterThan(0);
    const message = (await (await request.get(`${MAILPIT_URL}/api/v1/message/${found.messages[0].ID}`)).json()) as { Text: string };
    link = /https?:\/\/\S+(\/reset-password\?token=\S+)/.exec(message.Text)?.[1];
    expect(link).toBeDefined();
  }).toPass({ timeout: 10_000 });
  return link!;
}
