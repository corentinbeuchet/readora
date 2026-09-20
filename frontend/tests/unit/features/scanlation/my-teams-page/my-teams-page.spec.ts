import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MyTeamsPage } from '@app/features/scanlation/my-teams-page/my-teams-page';
import { WorkSummary } from '@app/core/models/catalog';
import { MyTeam, ScanlationRole } from '@app/core/models/scanlation';
import { Permission } from '@app/core/models/identity';
import { givenIAmSignedInWith } from '../../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

const SOLO: WorkSummary = { id: 'w-1', title: 'Solo Leveling', type: 'MANHWA', status: 'ONGOING', author: null, demographic: null, coverImageUrl: '', genres: [] };
const ORV: WorkSummary = { ...SOLO, id: 'w-2', title: 'Omniscient Reader' };

function team(overrides: Partial<MyTeam> = {}): MyTeam {
  return { id: 't-1', name: 'Moon Scans', description: 'We translate action series.', myRoles: ['LEADER'], boards: [{ projectId: 'p-1', work: SOLO }], ...overrides };
}

describe('MyTeamsPage (US-12)', () => {
  let fixture: ComponentFixture<MyTeamsPage>;
  let http: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyTeamsPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

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

  it('readers who only view boards cannot create a team', async () => {
    await givenIAmOnMyTeams({ teams: [team({ myRoles: ['TRANSLATOR'] })], permissions: ['PROJECT_VIEW'] });

    thenThereIsNoNewTeamForm();
  });

  it('a leader adds an existing series: the ones the team already has are left out', async () => {
    await givenIAmOnMyTeams({ teams: [team()] });

    await whenISearchTheCatalogFor('o', { found: [SOLO, ORV] });

    thenTheSeriesICanAddAre(['Omniscient Reader']);

    await whenIAddTheSeries('Omniscient Reader', { thenMyTeamsAre: [team({ boards: [{ projectId: 'p-1', work: SOLO }, { projectId: 'p-2', work: ORV }] })] });

    thenTheRequestWas('POST', `${API}/teams/t-1/series`, { workId: 'w-2' });
    thenThereIsALinkTo('/scanlation/p-2');
  });

  it('a leader adds a member with a role', async () => {
    await givenIAmOnMyTeams({ teams: [team()] });

    await whenIAddTheMember({ username: 'bob', role: 'PROOFREADER' }, { thenMyTeamsAre: [team()] });

    thenTheRequestWas('PUT', `${API}/teams/t-1/members/bob`, { roles: ['PROOFREADER'] });
    thenICanSee('bob is on the team.');
  });

  async function givenIAmOnMyTeams(given: { teams: MyTeam[]; permissions?: Permission[] }): Promise<void> {
    await givenIAmSignedInWith(given.permissions ?? ['PROJECT_VIEW', 'WORK_CREATE']);
    fixture = TestBed.createComponent(MyTeamsPage);
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(ok(given.teams));
    await settle(fixture);
  }

  async function givenMyTeamsFailToLoad(): Promise<void> {
    await givenIAmSignedInWith(['PROJECT_VIEW', 'WORK_CREATE']);
    fixture = TestBed.createComponent(MyTeamsPage);
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(fail('boom'), { status: 500, statusText: 'Server Error' });
    await settle(fixture);
  }

  async function whenIRetry(answer: { teams: MyTeam[] }): Promise<void> {
    button('Retry').click();
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(ok(answer.teams));
    await settle(fixture);
  }

  async function whenICreateTheTeam(draft: { name: string; description: string }, server: { answer: object; status?: number }): Promise<void> {
    type(field('#new-team-name'), draft.name);
    type(field('#new-team-description'), draft.description);
    await whenISubmitTheNewTeamForm();
    lastRequest = http.expectOne(`${API}/teams`);
    lastRequest.flush(server.answer, server.status ? { status: server.status, statusText: 'Bad Request' } : undefined);
    await settle(fixture);
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

  async function whenIAddTheMember(member: { username: string; role: ScanlationRole }, after: { thenMyTeamsAre: MyTeam[] }): Promise<void> {
    type(field('#member-username-t-1'), member.username);
    const select = fixture.nativeElement.querySelector('#member-role-t-1') as HTMLSelectElement;
    select.value = member.role;
    select.dispatchEvent(new Event('input'));
    form('details:nth-of-type(2) form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
    lastRequest = http.expectOne(`${API}/teams/t-1/members/${member.username}`);
    lastRequest.flush(ok(after.thenMyTeamsAre[0]));
    await settle(fixture);
    http.expectOne(`${API}/teams/mine`).flush(ok(after.thenMyTeamsAre));
    await settle(fixture);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenISeeTheAlert(text: string): void {
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(text);
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

  function thenThereIsNoNewTeamForm(): void {
    expect(fixture.nativeElement.querySelector('.new-team')).toBeNull();
  }

  function thenTheRequestWas(method: string, url: string, body: unknown): void {
    expect(lastRequest.request.method).toBe(method);
    expect(lastRequest.request.url).toBe(url);
    expect(lastRequest.request.body).toEqual(body);
    expect(lastRequest.request.body).not.toHaveProperty('userId');
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

  function button(label: string): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent!.trim() === label)!;
  }
});
