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

/** A manga opens page by page, where the end of the chapter only shows on the last page: a strip always has it. */
export async function whenIChooseTheReadingMode(page: Page, mode: 'Vertical' | 'Paged'): Promise<void> {
  await page.getByRole('button', { name: mode }).click();
  await expect(page.getByRole('button', { name: mode })).toHaveAttribute('aria-pressed', 'true');
}

export async function whenISwitchToTheVersionBy(page: Page, team: PublishingTeam): Promise<void> {
  await page.getByRole('link', { name: `Read this chapter by ${team.name}` }).click();
}

export async function whenIGoToTheNextChapter(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Next chapter' }).click();
}

/** The chapter's page and its team: the address says which version it is, the toolbar names the team. */
export async function thenIReadTheVersionBy(page: Page, team: PublishingTeam, chapterNumber: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/read/${team.chapterIds[chapterNumber]}$`));
  await expect(page.getByRole('link', { name: `Translated by ${team.name}` })).toBeVisible();
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

export type Headers = Record<string, string>;

/** A team of a series and the chapters it published there, by chapter number. */
export interface PublishingTeam {
  id: string;
  name: string;
  chapterIds: Record<string, string>;
}

/**
 * The publisher's login, shared by the tests of a worker (module state) for less than the access token's 15 minutes:
 * logins are rate-limited per IP, and a login per helper call used most of the limit.
 */
let publisherLogin: { headers: Promise<Headers>; at: number } | undefined;
const PUBLISHER_LOGIN_REUSE_MS = 10 * 60 * 1000;

/** API headers of the publisher account: it leads both e2e teams and may moderate, so its chapters go out at once. */
export async function givenIAmThePublisher(request: APIRequestContext): Promise<Headers> {
  if (!publisherLogin || Date.now() - publisherLogin.at > PUBLISHER_LOGIN_REUSE_MS) {
    const headers = logInThroughTheApi(request, PUBLISHER);
    publisherLogin = { headers, at: Date.now() };
    headers.catch(() => (publisherLogin = undefined));
  }
  return publisherLogin.headers;
}

async function logInThroughTheApi(request: APIRequestContext, account: { email: string; password: string }): Promise<Headers> {
  const { accessToken } = await data<{ accessToken: string }>(await request.post(`${API_URL}/auth/login`, { data: account }));
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * The two teams the e2e series are published by, led by the publisher and reused by every test and run: a series
 * created without a team gets a new team of its own, which piled thousands of teams on the publisher account.
 */
export const E2E_TEAMS = { first: 'E2E Publishers', second: 'E2E Second Team' } as const;

/** Found or created once per worker (module state), then reused. */
const e2eTeams = new Map<string, Promise<{ id: string; name: string }>>();

export async function e2eTeam(request: APIRequestContext, headers: Headers, name: string): Promise<{ id: string; name: string }> {
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

/** What `POST /works` and `PUT /works/{id}` take (codes: `MANHWA`, `COMPLETED`, `SHOUNEN`, …). */
export interface SeriesDescription {
  title: string;
  synopsis: string;
  type: string;
  status: string;
  author?: string;
  demographic?: string;
  genres: string[];
  facts?: { alternativeTitles?: string[]; artist?: string; releaseYear?: number; originalLanguage?: string; contentRating?: string };
}

/** A new series, published by the first e2e team (its task board is created with it); `description` overrides the defaults. */
export async function createSeries(
  request: APIRequestContext,
  headers: Headers,
  description: Partial<SeriesDescription> = {}
): Promise<{ workId: string; title: string; team: PublishingTeam; description: SeriesDescription }> {
  const team = await e2eTeam(request, headers, E2E_TEAMS.first);
  const full: SeriesDescription = { title: `E2E Series ${uniqueSuffix()}`, synopsis: 'Created by the e2e suite.', type: 'MANGA', status: 'ONGOING', genres: ['Action'], ...description };
  const work = await data<{ id: string }>(await request.post(`${API_URL}/works`, { headers, data: { ...full, teamId: team.id } }));
  return { workId: work.id, title: full.title, team: { id: team.id, name: team.name, chapterIds: {} }, description: full };
}

/** Replaces the whole description of the series (a field left out is emptied). */
export async function describeSeries(request: APIRequestContext, headers: Headers, workId: string, description: SeriesDescription): Promise<void> {
  await data(await request.put(`${API_URL}/works/${workId}`, { headers, data: description }));
}

/** Publishes a two-page chapter of the series for one team (a chapter always belongs to a team). */
export async function publishChapterFor(request: APIRequestContext, headers: Headers, workId: string, team: PublishingTeam, chapterNumber: string, title: string): Promise<string> {
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

export async function thenTheFactIsNotListed(page: Page, label: string): Promise<void> {
  await expect(page.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) })).toHaveCount(0);
}

/**
 * A series created with facts (US-04) and one published chapter, led by the publisher account. The content rating
 * is left out on purpose, and the first other title is unique, so a search for it finds this series only.
 */
export async function publishSeriesWithFacts(request: APIRequestContext): Promise<{ workId: string; title: string; otherTitles: string[] }> {
  const headers = await givenIAmThePublisher(request);
  const otherTitles = [`Shin no Nakama ${uniqueSuffix()}`, 'The True Companion'];
  const series = await createSeries(request, headers, { facts: { alternativeTitles: otherTitles, artist: 'E2E Artist', releaseYear: 2019, originalLanguage: 'JAPANESE' } });
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

/** Logs in through the UI with any account. */
export async function logIn(page: Page, account: { email: string; password: string }): Promise<void> {
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
 * A series translated by two teams (US-12): the first team publishes `chapters.first`, the second team, which added
 * the series to its own, `chapters.second`. By default chapters 1 and 2 have two versions and chapter 3 only one.
 */
export async function publishSeriesByTwoTeams(
  request: APIRequestContext,
  chapters: { first: string[]; second: string[] } = { first: ['1', '2', '3'], second: ['1', '2'] }
): Promise<{ workId: string; title: string; firstTeam: PublishingTeam; secondTeam: PublishingTeam }> {
  const headers = await givenIAmThePublisher(request);
  const series = await createSeries(request, headers);
  const second = await e2eTeam(request, headers, E2E_TEAMS.second);
  const secondTeam: PublishingTeam = { id: second.id, name: second.name, chapterIds: {} };
  await data(await request.post(`${API_URL}/teams/${secondTeam.id}/series`, { headers, data: { workId: series.workId } }));

  for (const chapterNumber of chapters.first) {
    await publishChapterFor(request, headers, series.workId, series.team, chapterNumber, `Chapter ${chapterNumber}`);
  }
  for (const chapterNumber of chapters.second) {
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

/** A new reader leading a team whose task board holds `chapters` raw chapters, all waiting for them (US-12). */
export interface BusyLeader {
  account: RegisteredAccount;
  title: string;
  /** The series' task board. */
  projectId: string;
}

/** A new reader starts a team, adds a series, turns its task board on and puts raw chapters 1 to `chapters` on it. */
export async function leadABusyTeam(request: APIRequestContext, chapters: number): Promise<BusyLeader> {
  const account = await registerAccount(request, 'busy');
  const headers = { Authorization: `Bearer ${account.accessToken}` };
  const team = await data<{ id: string }>(await request.post(`${API_URL}/teams`, { headers, data: { name: `Busy Team ${uniqueSuffix()}` } }));
  const title = `E2E Busy Series ${uniqueSuffix()}`;
  const work = await data<{ id: string }>(
    await request.post(`${API_URL}/works`, { headers, data: { title, synopsis: 'Created by the e2e suite.', type: 'MANGA', status: 'ONGOING', genres: ['Action'], teamId: team.id } })
  );
  const board = await putRawChaptersOnTheBoard(request, headers, work.id, team.id, Array.from({ length: chapters }, (_, index) => String(index + 1)));
  return { account, title, projectId: board.projectId };
}

/** The task board of a team's series, turned on, and the task of each raw chapter put on it (by chapter number). */
export interface TaskBoard {
  projectId: string;
  taskIds: Record<string, string>;
}

/** Turns on the task board of the team for the series and puts one raw chapter per number on it (`pageCount` pages each). */
export async function putRawChaptersOnTheBoard(
  request: APIRequestContext,
  headers: Headers,
  workId: string,
  teamId: string,
  chapterNumbers: string[],
  pageCount = 1
): Promise<TaskBoard> {
  const projects = await data<{ id: string; teamId: string }[]>(await request.get(`${API_URL}/works/${workId}/projects`, { headers }));
  const project = projects.find((candidate) => candidate.teamId === teamId)!;
  await data(await request.put(`${API_URL}/scanlation/projects/${project.id}/board`, { headers, data: { enabled: true } }));
  const raw = await data<{ storageKey: string; cdnUrl: string }>(
    await request.post(`${API_URL}/storage/upload?folder=${encodeURIComponent(`scans/${workId}/${teamId}/raw`)}`, {
      headers,
      multipart: { file: { name: '1.png', mimeType: 'image/png', buffer: PAGE_PNG } }
    })
  );
  const taskIds: Record<string, string> = {};
  for (const chapterNumber of chapterNumbers) {
    const task = await data<{ id: string }>(
      await request.post(`${API_URL}/scanlation/projects/${project.id}/tasks`, {
        headers,
        data: { chapterNumber, pages: Array.from({ length: pageCount }, (_, index) => ({ pageNumber: index + 1, storageKey: raw.storageKey, cdnUrl: raw.cdnUrl, width: 1, height: 1 })) }
      })
    );
    taskIds[chapterNumber] = task.id;
  }
  return { projectId: project.id, taskIds };
}

/** Hands in the task's pages for its stage: a raw chapter submitted by a leader goes straight to translation. */
export async function submitTheTask(request: APIRequestContext, headers: Headers, board: TaskBoard, chapterNumber: string): Promise<void> {
  const taskUrl = `${API_URL}/scanlation/projects/${board.projectId}/tasks/${board.taskIds[chapterNumber]}`;
  const pages = await data<{ pageNumber: number; storageKey: string; cdnUrl: string; width: number; height: number }[]>(await request.get(`${taskUrl}/pages`, { headers }));
  await data(await request.post(`${taskUrl}/submit`, { headers, data: { pages } }));
}

/** QC approves the task: the chapter is published (a team's first chapter waits for a moderator). Returns its id. */
export async function publishTheTask(request: APIRequestContext, headers: Headers, board: TaskBoard, chapterNumber: string): Promise<string> {
  const chapter = await data<{ chapterId: string }>(
    await request.post(`${API_URL}/scanlation/projects/${board.projectId}/tasks/${board.taskIds[chapterNumber]}/publish`, { headers })
  );
  return chapter.chapterId;
}

/** A moderator (the publisher account may moderate) approves a team's first chapter. */
export async function approveTheChapter(request: APIRequestContext, chapterId: string): Promise<void> {
  await data(await request.post(`${API_URL}/moderation/chapters/${chapterId}/approve`, { headers: await givenIAmThePublisher(request) }));
}

export async function claimTheTask(request: APIRequestContext, headers: Headers, board: TaskBoard, chapterNumber: string): Promise<void> {
  await data(await request.post(`${API_URL}/scanlation/projects/${board.projectId}/tasks/${board.taskIds[chapterNumber]}/claim`, { headers }));
}

/** A team with many series and no chapter (US-12), started by a new reader. */
export interface TeamWithSeries {
  teamId: string;
  name: string;
  /** The reader who started it, its leader. */
  leader: RegisteredAccount;
  /** The series' titles, in the order they were created. */
  titles: string[];
  /** The series' ids, in the same order. */
  workIds: string[];
}

/**
 * A new reader starts a team and creates `count` series for it ("… 01", "… 02", …), each with its task board.
 * `options` names the team and its series otherwise (`titleOf(n)`, n from 1) and may give the leader.
 */
export async function startATeamWithSeries(
  request: APIRequestContext,
  count: number,
  options: { name?: string; titleOf?: (n: number) => string; leader?: RegisteredAccount } = {}
): Promise<TeamWithSeries> {
  const { teamId, name, leader } = await startATeam(request, options.name ?? `Many Series Team ${uniqueSuffix()}`, options.leader ?? (await registerAccount(request, 'many')));
  const headers = { Authorization: `Bearer ${leader.accessToken}` };
  const titleOf = options.titleOf ?? ((n: number) => `E2E Team Series ${uniqueSuffix()} ${String(n).padStart(2, '0')}`);
  const titles: string[] = [];
  const workIds: string[] = [];
  for (let n = 1; n <= count; n++) {
    const title = titleOf(n);
    titles.push(title);
    workIds.push(await createTeamSeries(request, headers, teamId, title));
  }
  return { teamId, name, leader, titles, workIds };
}

/** A new series brought in by a team (headers of its leader), with its task board (off). Returns its id. */
export async function createTeamSeries(request: APIRequestContext, headers: Headers, teamId: string, title: string): Promise<string> {
  const work = await data<{ id: string }>(
    await request.post(`${API_URL}/works`, { headers, data: { title, synopsis: 'Created by the e2e suite.', type: 'MANGA', status: 'ONGOING', genres: ['Action'], teamId } })
  );
  return work.id;
}

/** A team with no series yet, started by `leader`. */
export async function startATeam(request: APIRequestContext, name: string, leader: RegisteredAccount): Promise<{ teamId: string; name: string; leader: RegisteredAccount }> {
  const team = await data<{ id: string }>(await request.post(`${API_URL}/teams`, { headers: { Authorization: `Bearer ${leader.accessToken}` }, data: { name } }));
  return { teamId: team.id, name, leader };
}

/** The leader invites the reader with these roles (`TRANSLATOR`, …) and the reader accepts: they are on the team. */
export async function joinTheTeam(request: APIRequestContext, team: { teamId: string; leader: RegisteredAccount }, member: RegisteredAccount, roles: string[]): Promise<void> {
  const invitation = await data<{ id: string }>(
    await request.post(`${API_URL}/teams/${team.teamId}/invitations`, {
      headers: { Authorization: `Bearer ${team.leader.accessToken}` },
      data: { username: member.username, roles }
    })
  );
  await data(await request.post(`${API_URL}/invitations/${invitation.id}/accept`, { headers: { Authorization: `Bearer ${member.accessToken}` } }));
}

/** Gives the reader a display name (their profile). */
export async function nameTheReader(request: APIRequestContext, account: RegisteredAccount, displayName: string): Promise<void> {
  await data(await request.put(`${API_URL}/profile`, { headers: { Authorization: `Bearer ${account.accessToken}` }, data: { displayName } }));
}

/** Adds a series already in the catalog to a team (headers of one of its leaders). */
export async function addSeriesToTeam(request: APIRequestContext, headers: Headers, teamId: string, workId: string): Promise<void> {
  await data(await request.post(`${API_URL}/teams/${teamId}/series`, { headers, data: { workId } }));
}

/** The ids of the teams that work on the series (have a project on it). */
export async function teamsWorkingOn(request: APIRequestContext, workId: string): Promise<string[]> {
  const headers = await givenIAmThePublisher(request);
  const projects = await data<{ teamId: string }[]>(await request.get(`${API_URL}/works/${workId}/projects`, { headers }));
  return projects.map((project) => project.teamId);
}

/** Logs in through the UI as an account a test created. */
export async function givenIAmLoggedInAs(page: Page, account: { email: string }): Promise<void> {
  await logIn(page, { email: account.email, password: PASSWORD });
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
  return registerAccountNamed(request, `${prefix}_${uniqueSuffix()}`);
}

/** A reader account with exactly this username (password `PASSWORD`). */
export async function registerAccountNamed(request: APIRequestContext, username: string): Promise<RegisteredAccount> {
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

/** The reader adds the series to their library. */
export async function addToLibrary(request: APIRequestContext, account: RegisteredAccount, workId: string): Promise<void> {
  await data(await request.put(`${API_URL}/library/${workId}`, { headers: { Authorization: `Bearer ${account.accessToken}` }, data: { status: 'READING' } }));
}

/** The reader opened the chapter (`finished`: and read it to the end). */
export async function recordARead(request: APIRequestContext, account: RegisteredAccount, chapterId: string, finished: boolean): Promise<void> {
  await data(await request.put(`${API_URL}/reading/chapters/${chapterId}`, { headers: { Authorization: `Bearer ${account.accessToken}` }, data: { finished } }));
}

/** A reading list of the reader's, empty and not published. */
export async function createAList(request: APIRequestContext, account: RegisteredAccount, title: string): Promise<string> {
  const list = await data<{ id: string }>(
    await request.post(`${API_URL}/lists`, { headers: { Authorization: `Bearer ${account.accessToken}` }, data: { title, description: null, published: false, items: [] } })
  );
  return list.id;
}
