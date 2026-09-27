import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Account, Story } from '../story';
import {
  Headers,
  PASSWORD,
  TaskBoard,
  approveTheChapter,
  claimTheTask,
  createTeamSeries,
  joinTheTeam,
  logIn,
  publishTheTask,
  putRawChaptersOnTheBoard,
  registerAccount,
  startATeam,
  submitTheTask
} from '../../support/helpers';

/**
 * US-02 task board. The team is started by a new reader (its leader, whom the scenarios don't name); the leader hands
 * in the stages the scenario skips, so a task reaches the stage it names.
 */
const { Given, When, Then } = createBdd(test);

/** The stages a leader's hand-ins go through: a raw chapter handed in goes straight to translation. */
const STAGES = ['RAW_UPLOADED', 'TRANSLATING', 'TYPESETTING', 'PROOFREADING', 'QC_REVIEW'];

Given('a scanlation team {string} exists', async ({ request, story }, team: string) => {
  await givenATeam(request, story, team);
});

Given('{string} has a scanlation project managed by {string}', async ({ request, story }, series: string, team: string) => {
  await givenTheTeamRunsABoardFor(request, story, team, series);
});

Given('team member {string} has role {string}', async ({ request, story }, member: string, role: string) => {
  await givenAMemberWithTheRole(request, story, member, role);
});

Given('{string} workflow task is assigned to {string} in stage {string}', async ({ request, story }, task: string, member: string, stage: string) => {
  await givenATaskAt(request, story, { chapter: chapterOf(task), stage, pages: 1 });
  await givenTheMemberClaimed(request, story, member, chapterOf(task));
});

Given('{string} workflow task is in stage {string} with {int} pages', async ({ request, story }, task: string, stage: string, pages: number) => {
  await givenATaskAt(request, story, { chapter: chapterOf(task), stage, pages });
});

Given('{int} chapters of {string} were published from the board', async ({ request, story }, count: number, _series: string) => {
  await givenChaptersPublishedFromTheBoard(request, story, count);
});

When('{string} opens the pages of {string} on the task board', async ({ page, story }, member: string, task: string) => {
  await givenIAmOnTheBoardAs(page, story, story.account(member));
  await whenIOpenThePagesOf(page, chapterOf(task));
});

When('a member asks for the older ones', async ({ page }) => {
  await whenIShowTheOlderPublishedChapters(page);
});

Then('the task board shows the task is held by {string}', async ({ page, story }, handle: string) => {
  await givenIAmOnTheBoardAs(page, story, leaderOf(story));
  await thenTheTaskIsHeldBy(page, story.recall('task'), story.username(handle.replace(/^@/, '')));
});

Then('she sees links to pages {int} to {int}', async ({ page, story }, first: number, last: number) => {
  await thenTheTaskLinksToPages(page, story.recall('task'), range(first, last));
});

Then('the published column shows the {int} latest', async ({ page, story }, count: number) => {
  await givenIAmOnTheBoardAs(page, story, leaderOf(story));
  await thenThePublishedChaptersAre(page, range(Number(story.recall('published')) - count + 1, Number(story.recall('published'))).reverse());
});

Then('all {int} are shown', async ({ page }, count: number) => {
  await thenThePublishedChaptersAre(page, range(1, count).reverse());
});

async function givenATeam(request: APIRequestContext, story: Story, team: string): Promise<void> {
  const leader = await registerAccount(request, 'leader');
  story.addTeam(team, { ...(await startATeam(request, story.title(team), leader)), titles: [], workIds: [] });
}

/** The team brings the series in and turns its task board on. */
async function givenTheTeamRunsABoardFor(request: APIRequestContext, story: Story, team: string, series: string): Promise<void> {
  const readers = story.readersTeam(team);
  const headers = leaderHeaders(story, team);
  const workId = await createTeamSeries(request, headers, readers.teamId, story.title(series));
  story.addBoard(series, await putRawChaptersOnTheBoard(request, headers, workId, readers.teamId, []));
  story.remember('board team', team);
  story.remember('board work', workId);
}

async function givenAMemberWithTheRole(request: APIRequestContext, story: Story, member: string, role: string): Promise<void> {
  await joinTheTeam(request, story.readersTeam(story.recall('board team')), await story.newReader(member), [role]);
}

/** A raw chapter on the board, handed in by the leader until it reaches `stage`. */
async function givenATaskAt(request: APIRequestContext, story: Story, task: { chapter: string; stage: string; pages: number }): Promise<void> {
  const team = story.recall('board team');
  const headers = leaderHeaders(story, team);
  const readers = story.readersTeam(team);
  const board = boardWith(story, await putRawChaptersOnTheBoard(request, headers, workIdOf(story), readers.teamId, [task.chapter], task.pages));
  for (let stage = 0; stage < STAGES.indexOf(task.stage); stage++) {
    await submitTheTask(request, headers, board, task.chapter);
  }
  story.remember('task', task.chapter);
}

async function givenTheMemberClaimed(request: APIRequestContext, story: Story, member: string, chapter: string): Promise<void> {
  await claimTheTask(request, { Authorization: `Bearer ${story.account(member).accessToken!}` }, story.board(story.theBoardSeries()), chapter);
}

/**
 * Each chapter goes through every stage and QC publishes it. The team's first chapter waits for a moderator: the
 * publisher account approves it, so the next ones go out straight away (and nothing is left in the shared queue).
 */
async function givenChaptersPublishedFromTheBoard(request: APIRequestContext, story: Story, count: number): Promise<void> {
  const team = story.recall('board team');
  const headers = leaderHeaders(story, team);
  const chapters = range(1, count).map(String);
  const board = boardWith(story, await putRawChaptersOnTheBoard(request, headers, workIdOf(story), story.readersTeam(team).teamId, chapters));
  for (const chapter of chapters) {
    for (let stage = 0; stage < STAGES.indexOf('QC_REVIEW'); stage++) {
      await submitTheTask(request, headers, board, chapter);
    }
    const chapterId = await publishTheTask(request, headers, board, chapter);
    if (chapter === '1') {
      await approveTheChapter(request, chapterId);
    }
  }
  story.remember('published', String(count));
}

async function givenIAmOnTheBoardAs(page: Page, story: Story, account: Account): Promise<void> {
  await logIn(page, account);
  await page.goto(`/scanlation/${story.board(story.theBoardSeries()).projectId}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function whenIOpenThePagesOf(page: Page, chapter: string): Promise<void> {
  await taskOfChapter(page, chapter).getByText(/^\d+ pages?$/).click();
}

async function whenIShowTheOlderPublishedChapters(page: Page): Promise<void> {
  await publishedColumn(page).getByRole('button', { name: /^Show \d+ older chapters?$/ }).click();
}

async function thenTheTaskIsHeldBy(page: Page, chapter: string, username: string): Promise<void> {
  await expect(taskOfChapter(page, chapter)).toContainText(`Assigned: @${username}`);
}

async function thenTheTaskLinksToPages(page: Page, chapter: string, pages: number[]): Promise<void> {
  await expect(taskOfChapter(page, chapter).getByRole('link', { name: /^Page \d+$/ })).toHaveText(pages.map((pageNumber) => `Page ${pageNumber}`));
}

async function thenThePublishedChaptersAre(page: Page, chapters: number[]): Promise<void> {
  await expect(publishedColumn(page).getByRole('article')).toHaveText(chapters.map((chapter) => new RegExp(`^\\s*Chapter ${chapter}(?!\\d)`)));
}

function taskOfChapter(page: Page, chapter: string): Locator {
  return page.getByRole('article').filter({ has: page.getByText(`Chapter ${chapter}`, { exact: true }) });
}

function publishedColumn(page: Page): Locator {
  return page.getByRole('region', { name: 'Published' });
}

function leaderHeaders(story: Story, team: string): Headers {
  return { Authorization: `Bearer ${story.readersTeam(team).leader.accessToken}` };
}

/** The board of the scenario's series, with the tasks just put on it added to the ones already there. */
function boardWith(story: Story, added: TaskBoard): TaskBoard {
  const series = story.theBoardSeries();
  const board = { projectId: added.projectId, taskIds: { ...story.board(series).taskIds, ...added.taskIds } };
  story.addBoard(series, board);
  return board;
}

function workIdOf(story: Story): string {
  return story.recall('board work');
}

/** The team's leader, who logs in to look at the board. */
function leaderOf(story: Story): Account {
  return { ...story.readersTeam(story.recall('board team')).leader, password: PASSWORD };
}

/** "Chapter 10" → "10". */
function chapterOf(task: string): string {
  return task.replace(/^Chapter /, '');
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
