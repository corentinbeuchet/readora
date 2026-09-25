import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MyTeamsPage } from '@app/features/scanlation/my-teams-page/my-teams-page';
import { WorkSummary } from '@app/core/models/catalog';
import { MyTeam, ScanlationRole, TeamInvitation, WaitingTask } from '@app/core/models/scanlation';
import { Permission } from '@app/core/models/identity';
import { givenIAmSignedInWith } from '../../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

const SOLO: WorkSummary = { id: 'w-1', title: 'Solo Leveling', type: 'MANHWA', status: 'ONGOING', author: null, demographic: null, coverImageUrl: '', coverThumbnailUrl: null, genres: [] };
const ORV: WorkSummary = { ...SOLO, id: 'w-2', title: 'Omniscient Reader' };

function invitation(overrides: Partial<TeamInvitation> = {}): TeamInvitation {
  return { id: 'i-1', teamId: 't-2', teamName: 'Sun Scans', invitee: 'jane', roles: ['TRANSLATOR'], invitedBy: 'mina', status: 'PENDING', createdAt: '2026-09-23T10:00:00Z', ...overrides };
}

function waitingTask(overrides: Partial<WaitingTask> = {}): WaitingTask {
  return { projectId: 'p-1', work: { id: 'w-1', title: 'Solo Leveling' }, team: { id: 't-1', name: 'Moon Scans' }, taskId: 'task-1', chapterNumber: '1', stage: 'TRANSLATING', mine: false, ...overrides };
}

/** Boards of "Saga 1" to "Saga <count>". */
function sagas(count: number): MyTeam['boards'] {
  return Array.from({ length: count }, (_, i) => ({ projectId: `p-s${i + 1}`, work: { ...SOLO, id: `w-s${i + 1}`, title: `Saga ${i + 1}` }, boardEnabled: true }));
}

function sagaTitles(first: number, last: number): string[] {
  return Array.from({ length: last - first + 1 }, (_, i) => `Saga ${first + i}`);
}

function team(overrides: Partial<MyTeam> = {}): MyTeam {
  return { id: 't-1', name: 'Moon Scans', description: 'We translate action series.', myRoles: ['LEADER'], boards: [{ projectId: 'p-1', work: SOLO, boardEnabled: true }], ...overrides };
}

describe('MyTeamsPage (US-12)', () => {
  let fixture: ComponentFixture<MyTeamsPage>;
  let http: HttpTestingController;
  let lastRequest: TestRequest;
  let lastWaitingRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyTeamsPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Each panel loads its roster (own spec: team-roster) and a leader's its invitations waiting for an answer (own
    // spec: invite-member), unless a test answered them.
    http.match((request) => /\/teams\/[^/]+\/invitations$/.test(request.url)).forEach((request) => request.flush(ok([])));
    http.match((request) => /\/teams\/[^/]+\/members$/.test(request.url)).forEach((request) => request.flush(ok([])));
    // Typing a username asks for suggestions after a pause (own spec: invite-member).
    http.match((request) => request.url === `${API}/users`).forEach((request) => request.flush(ok([])));
    http.verify();
  });

  it('lists my teams with my roles and a link to each task board', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR', 'PROOFREADER'] })] });

    thenThereIsALinkTo('/teams/t-1');
    thenThereIsALinkTo('/scanlation/p-1');
    thenMyRolesAre(['Translator', 'Proofreader']);
  });

  it('only leaders get the tools to add a series or a member', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR'] })] });

    thenTheToolsAre([]);
  });

  it('leaders and quality checkers can publish a chapter of a series for the team', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['QUALITY_CHECKER'] })] });

    thenThereIsALinkTo('/upload?workId=w-1&teamId=t-1');
  });

  it('other members do not get the publish link', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR'] })] });

    thenThereIsNoLinkTo('/upload?workId=w-1&teamId=t-1');
  });

  it('leaders can edit the page of a series the team translates', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['LEADER'] })] });

    thenThereIsALinkTo('/scanlation/series/w-1');
  });

  it('other members, quality checkers included, do not get the edit link', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['QUALITY_CHECKER'] })] });

    thenThereIsNoLinkTo('/scanlation/series/w-1');
  });

  it('without a team, says how to get one', async () => {
    await givenIAmOnMyTeams({ teams: [] });

    thenICanSee('You are not on a team yet.');
  });

  it('a failed load can be retried', async () => {
    await givenMyTeamsFailToLoad();

    await whenIRetry({ teams: [team()] });

    thenThereIsALinkTo('/teams/t-1');
  });

  it('creates a team and shows it first', async () => {
    await givenIAmOnMyTeams({ teams: [team()] });

    await whenICreateTheTeam({ name: ' Sun Scans ', description: 'Romance.' }, { answer: ok(team({ id: 't-2', name: 'Sun Scans', boards: [] })) });

    thenTheRequestWas('POST', `${API}/teams`, { name: 'Sun Scans', description: 'Romance.' });
    thenMyTeamsAre(['Sun Scans', 'Moon Scans']);
  });

  it('a team name that is taken is explained, and nothing is added', async () => {
    await givenIAmOnMyTeams({ teams: [team()] });

    await whenICreateTheTeam({ name: 'Moon Scans', description: '' }, { answer: fail('A team named Moon Scans already exists', 'TEAM_NAME_TAKEN'), status: 400 });

    thenISeeTheAlert('A team already has this name. Choose another one.');
    thenMyTeamsAre(['Moon Scans']);
  });

  it('a team needs a name before anything is sent', async () => {
    await givenIAmOnMyTeams({ teams: [] });

    await whenISubmitTheNewTeamForm();

    thenICanSee('Give your team a name');
  });

  it('a translator in one team can still start their own team', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR'] })], permissions: ['LIBRARY_USE'] });

    thenThereIsANewTeamForm();
  });

  it('a leader adds an existing series: the ones the team already has are left out', async () => {
    await givenIAmOnMyTeams({ teams: [team()] });

    await whenISearchTheCatalogFor('o', { found: [SOLO, ORV] });

    thenTheSeriesICanAddAre(['Omniscient Reader']);

    await whenIAddTheSeries('Omniscient Reader', { thenMyTeamsAre: [team({ boards: [{ projectId: 'p-1', work: SOLO, boardEnabled: true }, { projectId: 'p-2', work: ORV, boardEnabled: true }] })] });

    thenTheRequestWas('POST', `${API}/teams/t-1/series`, { workId: 'w-2' });
    thenThereIsALinkTo('/scanlation/p-2');
  });

  it('a series without a task board has no board link, and a leader can turn one on', async () => {
    await givenIAmOnMyTeams({ teams: [team({ boards: [{ projectId: 'p-1', work: SOLO, boardEnabled: false }] })] });

    thenThereIsNoLinkTo('/scanlation/p-1');

    await whenISwitchTheBoard('Use a task board for Solo Leveling', { thenMyTeamsAre: [team()] });

    thenTheRequestWas('PUT', `${API}/scanlation/projects/p-1/board`, { enabled: true });
    thenThereIsALinkTo('/scanlation/p-1');
  });

  it('a leader invites a reader, who waits for an answer until they accept', async () => {
    await givenIAmOnMyTeams({ teams: [team()], waitingForAnAnswer: [] });

    await whenIInvite({ username: 'bob', role: 'PROOFREADER' });

    thenTheRequestWas('POST', `${API}/teams/t-1/invitations`, { username: 'bob', roles: ['PROOFREADER'] });
    thenICanSee('bob is invited and joins the team once they accept.');
    thenTheInvitationsWaitingForAnAnswerAre(['bob']);
  });

  it('a leader cancels an invitation that waits for an answer', async () => {
    await givenIAmOnMyTeams({ teams: [team()], waitingForAnAnswer: [invitation({ id: 'i-9', teamId: 't-1', invitee: 'aoi' })] });

    await whenICancelTheInvitationOf('aoi');

    thenTheRequestWas('DELETE', `${API}/teams/t-1/invitations/i-9`, null);
    thenTheInvitationsWaitingForAnAnswerAre([]);
  });

  it('I join a team by accepting its invitation', async () => {
    await givenIAmOnMyTeams({ teams: [], invitations: [invitation()] });

    thenICanSee('mina invited you to join Sun Scans');

    await whenIAnswerTheInvitation('Join Sun Scans', { thenMyTeamsAre: [team({ id: 't-2', name: 'Sun Scans', myRoles: ['TRANSLATOR'] })] });

    thenTheRequestWas('POST', `${API}/invitations/i-1/accept`, {});
    thenMyTeamsAre(['Sun Scans']);
    thenICannotSee('mina invited you to join');
  });

  it('invitations that could not be loaded can be retried', async () => {
    await givenMyInvitationsFailToLoad();

    thenICanSee('Could not load your invitations.');

    await whenIRetry({ teams: [], invitations: [invitation()] });

    thenICanSee('mina invited you to join Sun Scans');
  });

  it('A member leaves a team', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR'] })] });
    await givenTheRosterOfMoonScansIs([{ username: 'mina', roles: ['LEADER'] }, { username: 'reader', roles: ['TRANSLATOR'] }]);

    await whenILeaveTheTeam({ thenMyTeamsAre: [] });

    thenTheRequestWas('DELETE', `${API}/teams/t-1/members/reader`, null);
    thenMyTeamsAre([]);
  });

  it('The Studio lists what waits for me, first what I claimed', async () => {
    await givenIAmOnMyTeams({
      teams: [team({ myRoles: ['TRANSLATOR'] })],
      waitingForMe: [waitingTask({ taskId: 'task-2', chapterNumber: '2', mine: true }), waitingTask({ taskId: 'task-3', chapterNumber: '3', mine: false })]
    });

    thenTheWaitingChaptersAre(['Chapter 2 of Solo Leveling', 'Chapter 3 of Solo Leveling']);
    thenTheWaitingChapterIsClaimedByMe('Chapter 2 of Solo Leveling');
    thenTheWaitingChapterIsNotClaimedByMe('Chapter 3 of Solo Leveling');
    thenEachWaitingChapterLinksTo('/scanlation/p-1');
  });

  it('shows what waits for me 20 at a time, the next page on request', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR'] })], waitingForMe: [waitingTask({ chapterNumber: '1' })], waitingPages: 2 });

    thenICanSee('Page 1 / 2');
    await whenIShowTheNextPageOfWhatWaits([waitingTask({ taskId: 'task-21', chapterNumber: '21' })]);

    thenWhatWaitsWasAskedForPage(1);
    thenTheWaitingChaptersAre(['Chapter 21 of Solo Leveling']);
    thenICanSee('Page 2 / 2');
  });

  it('shows no pager when what waits fits on one page', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR'] })], waitingForMe: [waitingTask()] });

    thenICannotSee('Page 1 /');
  });

  it("The Studio lists a team's series 20 at a time, with a title filter", async () => {
    await givenIAmOnMyTeams({ teams: [team({ boards: sagas(30) })] });

    thenTheListedSeriesAre(sagaTitles(1, 20));
    thenICanSee('Page 1 / 2');

    await whenIClick('Next');

    thenTheListedSeriesAre(sagaTitles(21, 30));

    await whenIFilterTheSeriesBy('saga 2');

    thenTheListedSeriesAre(['Saga 2', ...sagaTitles(20, 29)]);
    thenICanSee('11 series match');
    thenICannotSee('Page 1 /');
  });

  it('asks for nothing that waits while I am on no team', async () => {
    await givenIAmOnMyTeams({ teams: [] });

    thenWhatWaitsWasNotAskedFor();
  });

  it('says so when nothing waits for me', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR'] })], waitingForMe: [] });

    thenICanSee('Nothing waits for you right now');
  });

  it('declining an invitation leaves my teams as they are', async () => {
    await givenIAmOnMyTeams({ teams: [], invitations: [invitation()] });

    await whenIAnswerTheInvitation('Decline the invitation of Sun Scans');

    thenTheRequestWas('POST', `${API}/invitations/i-1/decline`, {});
    thenICannotSee('mina invited you to join');
    thenICanSee('You are not on a team yet.');
  });

  /** `invitations`: the ones waiting for my answer; `waitingForAnAnswer`: the ones my team t-1 sent (I lead it). */
  async function givenIAmOnMyTeams(given: {
    teams: MyTeam[];
    permissions?: Permission[];
    invitations?: TeamInvitation[];
    waitingForAnAnswer?: TeamInvitation[];
    waitingForMe?: WaitingTask[];
    waitingPages?: number;
  }): Promise<void> {
    await givenIAmSignedInWith(given.permissions ?? ['LIBRARY_USE']);
    fixture = TestBed.createComponent(MyTeamsPage);
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(ok(given.teams));
    http.expectOne(`${API}/invitations/mine`).flush(ok(given.invitations ?? []));
    await settle(fixture);
    await whenWhatWaitsIsAnswered(given.waitingForMe ?? [], given.waitingPages);
    if (given.waitingForAnAnswer) {
      http.expectOne(`${API}/teams/t-1/invitations`).flush(ok(given.waitingForAnAnswer));
      await settle(fixture);
    }
  }

  async function givenMyTeamsFailToLoad(): Promise<void> {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    fixture = TestBed.createComponent(MyTeamsPage);
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(fail('boom'), { status: 500, statusText: 'Server Error' });
    http.expectOne(`${API}/invitations/mine`).flush(ok([]));
    await settle(fixture);
  }

  async function givenMyInvitationsFailToLoad(): Promise<void> {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    fixture = TestBed.createComponent(MyTeamsPage);
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(ok([]));
    http.expectOne(`${API}/invitations/mine`).flush(fail('boom'), { status: 500, statusText: 'Server Error' });
    await settle(fixture);
  }

  /** Retry reloads whichever list failed: my teams, or my invitations when `invitations` is given. */
  async function whenIRetry(answer: { teams: MyTeam[]; invitations?: TeamInvitation[] }): Promise<void> {
    button('Retry').click();
    await settle(fixture);
    if (answer.invitations) {
      http.expectOne(`${API}/invitations/mine`).flush(ok(answer.invitations));
    } else {
      http.expectOne(`${API}/teams/mine`).flush(ok(answer.teams));
    }
    await settle(fixture);
    await whenWhatWaitsIsAnswered([]);
  }

  /** Being on a team (loaded, created, joined) asks what waits for me; nothing is asked while I am on none. */
  async function whenWhatWaitsIsAnswered(waiting: WaitingTask[], totalPages = 1): Promise<void> {
    http.match((request) => request.url === `${API}/teams/mine/tasks`).forEach((request) => {
      lastWaitingRequest = request;
      const page = Number(request.request.params.get('page'));
      request.flush(ok({ items: waiting, page, size: 20, totalElements: (totalPages - 1) * 20 + waiting.length, totalPages }));
    });
    await settle(fixture);
  }

  async function whenIShowTheNextPageOfWhatWaits(waiting: WaitingTask[]): Promise<void> {
    button('Next').click();
    await settle(fixture);
    await whenWhatWaitsIsAnswered(waiting, 2);
  }

  async function whenICreateTheTeam(draft: { name: string; description: string }, server: { answer: object; status?: number }): Promise<void> {
    type(field('#new-team-name'), draft.name);
    type(field('#new-team-description'), draft.description);
    await whenISubmitTheNewTeamForm();
    lastRequest = http.expectOne(`${API}/teams`);
    lastRequest.flush(server.answer, server.status ? { status: server.status, statusText: 'Bad Request' } : undefined);
    await settle(fixture);
    await whenWhatWaitsIsAnswered([]);
  }

  async function whenISubmitTheNewTeamForm(): Promise<void> {
    form('.new-team').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  async function whenISearchTheCatalogFor(text: string, answer: { found: WorkSummary[] }): Promise<void> {
    type(field('#series-search-t-1'), text);
    form('details:nth-of-type(1) form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
    const search = http.expectOne((request) => request.url === `${API}/works` && request.params.get('q') === text);
    search.flush(ok({ items: answer.found, page: 0, size: 5, totalItems: answer.found.length, totalPages: 1 }));
    await settle(fixture);
  }

  async function whenIAddTheSeries(title: string, after: { thenMyTeamsAre: MyTeam[] }): Promise<void> {
    const row = Array.from(fixture.nativeElement.querySelectorAll('.found-list li') as NodeListOf<HTMLElement>).find((li) => li.textContent!.includes(title))!;
    row.querySelector('button')!.click();
    lastRequest = http.expectOne(`${API}/teams/t-1/series`);
    lastRequest.flush(ok({ id: 'p-2', name: 'Moon Scans - Omniscient Reader', workId: 'w-2', teamId: 't-1', teamName: 'Moon Scans', members: [], tasks: [] }));
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(ok(after.thenMyTeamsAre));
    await settle(fixture);
  }

  async function whenIInvite(member: { username: string; role: ScanlationRole }): Promise<void> {
    type(field('#member-username-t-1'), member.username);
    const select = fixture.nativeElement.querySelector('#member-role-t-1') as HTMLSelectElement;
    select.value = member.role;
    select.dispatchEvent(new Event('input'));
    form('app-invite-member form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
    lastRequest = http.expectOne(`${API}/teams/t-1/invitations`);
    lastRequest.flush(ok(invitation({ id: 'i-2', teamId: 't-1', teamName: 'Moon Scans', invitee: member.username, roles: [member.role] })));
    await settle(fixture);
  }

  /** Signed-in tests are "reader" (`mockUser`), so a roster with "reader" lists me. */
  async function givenTheRosterOfMoonScansIs(members: { username: string; roles: ScanlationRole[] }[]): Promise<void> {
    http.expectOne(`${API}/teams/t-1/members`).flush(ok(members));
    await settle(fixture);
  }

  async function whenILeaveTheTeam(after: { thenMyTeamsAre: MyTeam[] }): Promise<void> {
    button('Leave the team').click();
    await settle(fixture);
    lastRequest = http.expectOne((request) => request.method === 'DELETE');
    lastRequest.flush(ok(team()));
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(ok(after.thenMyTeamsAre));
    await settle(fixture);
  }

  async function whenISwitchTheBoard(label: string, after: { thenMyTeamsAre: MyTeam[] }): Promise<void> {
    button(label).click();
    await settle(fixture);
    lastRequest = http.expectOne(`${API}/scanlation/projects/p-1/board`);
    lastRequest.flush(ok({ id: 'p-1', name: 'Moon Scans - Solo Leveling', workId: 'w-1', teamId: 't-1', teamName: 'Moon Scans', boardEnabled: true, members: [], tasks: [] }));
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(ok(after.thenMyTeamsAre));
    await settle(fixture);
    await whenWhatWaitsIsAnswered([]);
  }

  async function whenICancelTheInvitationOf(invitee: string): Promise<void> {
    button(`Cancel the invitation of ${invitee}`).click();
    await settle(fixture);
    lastRequest = http.expectOne((request) => request.method === 'DELETE');
    lastRequest.flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
  }

  /** Accept ("Join …") answers with the team and reloads my teams; Decline answers with a message. */
  async function whenIAnswerTheInvitation(label: string, after: { thenMyTeamsAre?: MyTeam[] } = {}): Promise<void> {
    button(label).click();
    await settle(fixture);
    lastRequest = http.expectOne((request) => request.url.startsWith(`${API}/invitations/i-1/`));
    lastRequest.flush(ok(after.thenMyTeamsAre ? after.thenMyTeamsAre[0] : 'Declined'));
    await settle(fixture);
    if (after.thenMyTeamsAre) {
      http.expectOne(`${API}/teams/mine`).flush(ok(after.thenMyTeamsAre));
      await settle(fixture);
      await whenWhatWaitsIsAnswered([]);
    }
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenICannotSee(text: string): void {
    expect(fixture.nativeElement.textContent).not.toContain(text);
  }

  function thenWhatWaitsWasNotAskedFor(): void {
    http.expectNone((request) => request.url === `${API}/teams/mine/tasks`);
  }

  function thenWhatWaitsWasAskedForPage(page: number): void {
    expect(lastWaitingRequest.request.params.get('page')).toBe(String(page));
  }

  function waitingItems(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.waiting-item'));
  }

  function waitingItem(chapter: string): HTMLElement {
    return waitingItems().find((li) => li.querySelector('a')!.textContent!.trim() === chapter)!;
  }

  function thenTheWaitingChaptersAre(chapters: string[]): void {
    expect(waitingItems().map((li) => li.querySelector('a')!.textContent!.trim())).toEqual(chapters);
  }

  function thenTheWaitingChapterIsClaimedByMe(chapter: string): void {
    expect(waitingItem(chapter).textContent).toContain('Claimed by you');
  }

  function thenTheWaitingChapterIsNotClaimedByMe(chapter: string): void {
    expect(waitingItem(chapter).textContent).not.toContain('Claimed by you');
  }

  function thenEachWaitingChapterLinksTo(href: string): void {
    expect(waitingItems().map((li) => li.querySelector('a')!.getAttribute('href'))).toEqual(waitingItems().map(() => href));
  }

  function thenTheInvitationsWaitingForAnAnswerAre(invitees: string[]): void {
    const rows = Array.from(fixture.nativeElement.querySelectorAll('app-team-panel .invitee') as NodeListOf<HTMLElement>);
    expect(rows.map((row) => row.textContent!.trim())).toEqual(invitees);
  }

  function thenISeeTheAlert(text: string): void {
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(text);
  }

  async function whenIClick(label: string): Promise<void> {
    button(label).click();
    await settle(fixture);
  }

  async function whenIFilterTheSeriesBy(text: string): Promise<void> {
    type(fixture.nativeElement.querySelector('input[id^="series-filter-"]'), text);
    await settle(fixture);
  }

  function thenTheListedSeriesAre(titles: string[]): void {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.board-list .board'));
    expect(rows.map((row) => row.querySelector('a')!.textContent!.trim())).toEqual(titles);
  }

  function thenThereIsALinkTo(href: string): void {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>).map((a) => a.getAttribute('href'));
    expect(links).toContain(href);
  }

  function thenThereIsNoLinkTo(href: string): void {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>).map((a) => a.getAttribute('href'));
    expect(links).not.toContain(href);
  }

  function thenMyRolesAre(labels: string[]): void {
    const roles = Array.from(fixture.nativeElement.querySelectorAll('[aria-label="My roles"] li') as NodeListOf<HTMLElement>);
    expect(roles.map((li) => li.textContent!.trim())).toEqual(labels);
  }

  function thenMyTeamsAre(names: string[]): void {
    const headings = Array.from(fixture.nativeElement.querySelectorAll('app-team-panel h2') as NodeListOf<HTMLElement>);
    expect(headings.map((h) => h.textContent!.trim())).toEqual(names);
  }

  function thenTheToolsAre(summaries: string[]): void {
    const tools = Array.from(fixture.nativeElement.querySelectorAll('summary') as NodeListOf<HTMLElement>);
    expect(tools.map((s) => s.textContent!.trim())).toEqual(summaries);
  }

  function thenTheSeriesICanAddAre(titles: string[]): void {
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.found-list li > span') as NodeListOf<HTMLElement>);
    expect(rows.map((span) => span.textContent!.trim())).toEqual(titles);
  }

  function thenThereIsANewTeamForm(): void {
    expect(fixture.nativeElement.querySelector('.new-team')).not.toBeNull();
  }

  /** Identity never travels in a body; a DELETE has none (`body` null). */
  function thenTheRequestWas(method: string, url: string, body: unknown): void {
    expect(lastRequest.request.method).toBe(method);
    expect(lastRequest.request.url).toBe(url);
    expect(lastRequest.request.body).toEqual(body);
    expect(lastRequest.request.body ?? {}).not.toHaveProperty('userId');
  }

  function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  function field(selector: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(selector);
  }

  function form(selector: string): HTMLFormElement {
    return fixture.nativeElement.querySelector(selector);
  }

  /** By accessible text: visible label plus any `.sr-only` part ("Join Sun Scans"). */
  function button(label: string): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent!.replace(/\s+/g, ' ').trim() === label)!;
  }
});
