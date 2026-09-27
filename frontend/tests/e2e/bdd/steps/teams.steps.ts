import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Account, Story } from '../story';
import { claimTheTask, joinTheTeam, logIn, nameTheReader, putRawChaptersOnTheBoard, registerAccount, startATeam, startATeamWithSeries, submitTheTask } from '../../support/helpers';

/** US-12 teams: a team's page, the Studio (what waits for me, a team's series), inviting, roles and leaving. */
const { Given, When, Then } = createBdd(test);

Given('the team {string} translates {int} series', async ({ request, story }, team: string, count: number) => {
  await givenATeamTranslating(request, story, { team, count });
});

Given('{string} leads {string}, which translates {int} series', async ({ request, story }, leader: string, team: string, count: number) => {
  await givenATeamTranslating(request, story, { team, count, leader });
});

Given('reader {string} leads the team {string}', async ({ request, story }, leader: string, team: string) => {
  await givenATeamWithMembers(request, story, { team, leader });
});

Given('reader {string} leads {string}, where {string} is a translator', async ({ request, story }, leader: string, team: string, translator: string) => {
  await givenATeamWithMembers(request, story, { team, leader, translator });
});

Given('reader {string} is a translator in {string}', async ({ request, story }, translator: string, team: string) => {
  await givenATeamWithMembers(request, story, { team, translator, follow: translator });
});

Given('there is a reader {string} called {string}', async ({ request, story }, reader: string, displayName: string) => {
  await givenAReaderCalled(request, story, reader, displayName);
});

Given('{string} claimed chapter {int} of {string} and chapter {int} waits for a translator', async ({ request, story }, translator: string, claimed: number, series: string, waiting: number) => {
  await givenAClaimedAndAWaitingChapter(request, story, { translator, series, claimed, waiting });
});

When('a reader opens the page of the team {string}', async ({ page, story }, team: string) => {
  await whenIOpenTheTeamPage(page, story.readersTeam(team).teamId);
});

When('he/she opens the Studio', async ({ page, story }) => {
  await givenIAmInTheStudioAs(page, story.actor());
});

When('she types {string} in the series filter of {string}', async ({ page, story }, text: string, team: string) => {
  await whenIFilterTheSeriesOfTheTeam(page, story.teamName(team), text);
});

When('she types {string} to invite someone to {string}', async ({ page, story }, text: string, team: string) => {
  await givenIAmInTheStudioAs(page, story.actor());
  await whenITypeAUsernameToInvite(page, story.teamName(team), story.username(text));
});

When('she gives {string} the roles {word} and {word}', async ({ page, story }, member: string, first: string, second: string) => {
  await givenIAmInTheStudioAs(page, story.actor());
  await whenIChangeTheRolesOf(page, story.username(member), [first, second]);
});

When('she removes {string} from the team', async ({ page, story }, member: string) => {
  await givenIAmInTheStudioAs(page, story.actor());
  await whenIRemove(page, story.username(member));
});

When('he leaves {string}', async ({ page, story }, team: string) => {
  await givenIAmInTheStudioAs(page, story.actor());
  await whenILeaveTheTeam(page, story.teamName(team));
});

Then('each series is a card with the number of chapters the team published', async ({ page }) => {
  await thenEachSeriesCardCountsItsChapters(page, 24);
});

Then('a pager leads to the other {int}', async ({ page }, count: number) => {
  await whenIGoToTheNextPageOfTheTeamSeries(page);
  await thenEachSeriesCardCountsItsChapters(page, count);
});

Then('chapter {int} is listed first, as claimed by him, and chapter {int} after it', async ({ page, story }, claimed: number, waiting: number) => {
  const title = story.title(story.theBoardSeries());
  await thenWhatWaitsForMeIs(page, [`Chapter ${claimed} of ${title}`, `Chapter ${waiting} of ${title}`]);
  await thenOnlyThisOneIsClaimedByMe(page, `Chapter ${claimed} of ${title}`);
});

Then('each links to the task board of {string}', async ({ page, story }, series: string) => {
  await thenEveryWaitingChapterLinksTo(page, `/scanlation/${story.board(series).projectId}`);
});

Then('the panel of {string} lists {int} series and a pager to the other {int}', async ({ page, story }, team: string, shown: number, others: number) => {
  const teamSeries = story.readersTeam(team);
  await thenThePanelListsSeries(page, teamSeries.name, teamSeries.titles, shown);
  await whenIShowTheNextSeriesOf(page, teamSeries.name);
  await thenThePanelListsSeries(page, teamSeries.name, teamSeries.titles, others);
});

Then('only the series whose title contains {string} are listed, on one page', async ({ page, story }, text: string) => {
  const teamSeries = story.readersTeam(story.teamLedBy(story.actorNamed()));
  await thenThePanelListsExactly(page, teamSeries.name, teamSeries.titles, teamSeries.titles.filter((title) => title.toLowerCase().includes(text.toLowerCase())));
  await thenThePanelHasNoPager(page, teamSeries.name);
});

Then('{string} is suggested, with their display name', async ({ page, story }, reader: string) => {
  const account = story.account(reader);
  await thenTheSuggestionsInclude(page, story.teamName(story.teamLedBy(story.actorNamed())), account.username!, account.displayName!);
});

Then('the roster shows {string} as {word} and {word}', async ({ page, story }, member: string, first: string, second: string) => {
  await thenTheRosterShowsTheRoles(page, story.username(member), [first, second]);
});

Then('{string} is no longer in the roster', async ({ page, story }, member: string) => {
  await thenTheRosterHasNo(page, story.username(member));
});

Then('{string} is no longer among his teams', async ({ page, story }, team: string) => {
  await thenIAmNotOn(page, story.teamName(team));
});

/** A team started by a new reader (`leader`, when the scenario names them) with `count` series, "… Saga 1" to "… Saga N". */
async function givenATeamTranslating(request: APIRequestContext, story: Story, scenario: { team: string; count: number; leader?: string }): Promise<void> {
  const leader = scenario.leader ? await story.newReader(scenario.leader) : undefined;
  const team = await startATeamWithSeries(request, scenario.count, { name: story.title(scenario.team), titleOf: (n) => story.title(`Saga ${n}`), leader });
  story.addTeam(scenario.team, team);
  if (scenario.leader) {
    story.leads(scenario.leader, scenario.team);
    story.follow(scenario.leader);
  }
}

/** A team with no series; its leader is a new reader (named or not), and a translator joined when the scenario names one. */
async function givenATeamWithMembers(request: APIRequestContext, story: Story, scenario: { team: string; leader?: string; translator?: string; follow?: string }): Promise<void> {
  const leader = scenario.leader ? await story.newReader(scenario.leader) : await registerAccount(request, 'leader');
  const team = await startATeam(request, story.title(scenario.team), leader);
  story.addTeam(scenario.team, { ...team, titles: [], workIds: [] });
  if (scenario.translator) {
    await joinTheTeam(request, team, await story.newReader(scenario.translator), ['TRANSLATOR']);
  }
  if (scenario.leader) {
    story.leads(scenario.leader, scenario.team);
  }
  story.follow(scenario.follow ?? scenario.leader!);
}

async function givenAReaderCalled(request: APIRequestContext, story: Story, reader: string, displayName: string): Promise<void> {
  await nameTheReader(request, await story.newReader(reader, displayName), displayName);
}

/**
 * The translator's team has the series on a task board with both chapters ready for translation (a leader handed in
 * the raw pages), and the translator claimed one of them.
 */
async function givenAClaimedAndAWaitingChapter(
  request: APIRequestContext,
  story: Story,
  scenario: { translator: string; series: string; claimed: number; waiting: number }
): Promise<void> {
  const leader = await registerAccount(request, 'leader');
  const team = await startATeamWithSeries(request, 1, { name: story.title('Team'), titleOf: () => story.title(scenario.series), leader });
  const translator = await story.newReader(scenario.translator);
  await joinTheTeam(request, team, translator, ['TRANSLATOR']);
  const leaderHeaders = { Authorization: `Bearer ${leader.accessToken}` };
  const chapters = [String(scenario.claimed), String(scenario.waiting)];
  const board = await putRawChaptersOnTheBoard(request, leaderHeaders, team.workIds[0], team.teamId, chapters);
  for (const chapter of chapters) {
    await submitTheTask(request, leaderHeaders, board, chapter);
  }
  await claimTheTask(request, { Authorization: `Bearer ${translator.accessToken}` }, board, String(scenario.claimed));
  story.addBoard(scenario.series, board);
  story.follow(scenario.translator);
}

/** Logs in as the person and opens the Studio, unless the page is already there. */
async function givenIAmInTheStudioAs(page: Page, account: Account): Promise<void> {
  if (new URL(page.url(), 'http://any').pathname === '/scanlation') {
    return;
  }
  await logIn(page, account);
  await page.goto('/scanlation');
  await expect(page.getByRole('heading', { level: 1, name: 'Studio' })).toBeVisible();
}

async function whenIOpenTheTeamPage(page: Page, teamId: string): Promise<void> {
  await page.goto(`/teams/${teamId}`);
}

async function whenIGoToTheNextPageOfTheTeamSeries(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: "Pages of the team's series" }).getByRole('link', { name: 'Next' }).click();
}

async function whenIFilterTheSeriesOfTheTeam(page: Page, teamName: string, text: string): Promise<void> {
  await panelOf(page, teamName).getByLabel('Find a series by its title').fill(text);
}

async function whenIShowTheNextSeriesOf(page: Page, teamName: string): Promise<void> {
  await panelOf(page, teamName).getByRole('button', { name: 'Next' }).click();
}

async function whenITypeAUsernameToInvite(page: Page, teamName: string, text: string): Promise<void> {
  const panel = panelOf(page, teamName);
  await panel.getByText('Invite a member', { exact: true }).click();
  await panel.getByLabel('Username').fill(text);
}

async function whenIChangeTheRolesOf(page: Page, username: string, roles: string[]): Promise<void> {
  await page.getByRole('button', { name: `Change roles of ${username}` }).click();
  const editor = page.getByRole('group', { name: `Roles of ${username}` });
  for (const role of roles) {
    await editor.getByRole('checkbox', { name: role }).check();
  }
  await editor.getByRole('button', { name: 'Save the roles' }).click();
}

async function whenIRemove(page: Page, username: string): Promise<void> {
  await page.getByRole('button', { name: `Remove ${username} from the team` }).click();
}

async function whenILeaveTheTeam(page: Page, teamName: string): Promise<void> {
  await panelOf(page, teamName).getByRole('button', { name: 'Leave the team' }).click();
}

/** `count` cards on the page of the team, each saying how many chapters the team published ("No chapter yet" too). */
async function thenEachSeriesCardCountsItsChapters(page: Page, count: number): Promise<void> {
  await expect(page.getByRole('region', { name: 'Series' }).getByRole('listitem')).toHaveText(Array<RegExp>(count).fill(/No chapter yet|\d+ chapters?/));
}

function whatWaitsForMe(page: Page): Locator {
  return page.getByRole('region', { name: 'Waiting for you' });
}

async function thenWhatWaitsForMeIs(page: Page, chapters: string[]): Promise<void> {
  await expect(whatWaitsForMe(page).getByRole('link')).toHaveText(chapters);
}

async function thenOnlyThisOneIsClaimedByMe(page: Page, chapter: string): Promise<void> {
  await expect(whatWaitsForMe(page).getByRole('listitem').filter({ hasText: 'Claimed by you' }).getByRole('link')).toHaveText([chapter]);
}

async function thenEveryWaitingChapterLinksTo(page: Page, path: string): Promise<void> {
  const links = whatWaitsForMe(page).getByRole('link');
  await expect.poll(() => links.evaluateAll((anchors) => [...new Set(anchors.map((anchor) => anchor.getAttribute('href')))])).toEqual([path]);
}

function panelOf(page: Page, teamName: string): Locator {
  return page.getByRole('article', { name: teamName });
}

/** The series links of the team's panel: `shown` of them, all among the team's series. */
async function thenThePanelListsSeries(page: Page, teamName: string, titles: string[], shown: number): Promise<void> {
  await expect(seriesLinksOf(page, teamName, titles)).toHaveCount(shown);
}

/** The links to the series pages in the team's panel (its task-board links are named "Task board of …"). */
function seriesLinksOf(page: Page, teamName: string, titles: string[]): Locator {
  return panelOf(page, teamName).getByRole('listitem').getByRole('link', { name: new RegExp(`^(${titles.map(escape).join('|')})$`) });
}

async function thenThePanelListsExactly(page: Page, teamName: string, allTitles: string[], titles: string[]): Promise<void> {
  await expect.poll(async () => (await seriesLinksOf(page, teamName, allTitles).allTextContents()).map((text) => text.trim()).sort()).toEqual([...titles].sort());
}

async function thenThePanelHasNoPager(page: Page, teamName: string): Promise<void> {
  await expect(panelOf(page, teamName).getByText(/^Page \d+ \/ \d+$/)).toHaveCount(0);
}

/**
 * A datalist's options are not in the accessibility tree: they are read from the field's `list`, as the browser
 * offers them.
 */
async function thenTheSuggestionsInclude(page: Page, teamName: string, username: string, displayName: string): Promise<void> {
  const field = panelOf(page, teamName).getByLabel('Username');
  await expect
    .poll(() => field.evaluate((input: HTMLInputElement) => Array.from(input.list?.options ?? []).map((option) => [option.value, option.textContent?.trim()])))
    .toContainEqual([username, displayName]);
}

/** The member's row: the list item with their buttons, not the team's whole panel around it. */
function rosterRowOf(page: Page, username: string): Locator {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: `Change roles of ${username}` }) })
    .filter({ hasNot: page.getByRole('article') });
}

/** Once saved, the roles editor closes and the row shows the roles as badges. */
async function thenTheRosterShowsTheRoles(page: Page, username: string, roles: string[]): Promise<void> {
  await expect(page.getByRole('group', { name: `Roles of ${username}` })).toHaveCount(0);
  for (const role of roles) {
    await expect(rosterRowOf(page, username).getByText(role, { exact: true })).toBeVisible();
  }
}

async function thenTheRosterHasNo(page: Page, username: string): Promise<void> {
  await expect(page.getByText(username, { exact: true })).toHaveCount(0);
}

async function thenIAmNotOn(page: Page, teamName: string): Promise<void> {
  await expect(panelOf(page, teamName)).toHaveCount(0);
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
