import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TeamRoster } from '@app/features/scanlation/my-teams-page/team-panel/team-roster/team-roster';
import { MyTeam, ScanlationRole } from '@app/core/models/scanlation';
import { givenIAmSignedInWith } from '../../../../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting, settle } from '../../../../../test-utils';

interface Member {
  username: string;
  roles: ScanlationRole[];
}

/** Signed-in tests are "reader" (`mockUser`): the leader of Moon Scans here. */
const MOON_SCANS: MyTeam = { id: 't-1', name: 'Moon Scans', description: null, myRoles: ['LEADER'], boards: [] };
const ME: Member = { username: 'reader', roles: ['LEADER'] };

describe('TeamRoster (US-12)', () => {
  let fixture: ComponentFixture<TeamRoster>;
  let http: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamRoster],
      providers: [...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('A leader changes the roles of a member, or removes them', async () => {
    await givenIAmOnTheRosterOf(MOON_SCANS, [ME, { username: 'bob', roles: ['TRANSLATOR'] }]);

    await whenIGiveTheRoles('bob', ['TRANSLATOR', 'PROOFREADER'], { rosterAfter: [ME, { username: 'bob', roles: ['PROOFREADER', 'TRANSLATOR'] }] });

    thenTheRequestWas('PUT', `${API}/teams/t-1/members/bob`, { roles: ['TRANSLATOR', 'PROOFREADER'] });
    thenTheRosterShows('bob', ['Proofreader', 'Translator']);

    await whenIRemove('bob', { rosterAfter: [ME] });

    thenTheRequestWas('DELETE', `${API}/teams/t-1/members/bob`, null);
    thenTheMembersAre(['reader']);
    thenTheFocusIsOn('Members');
  });

  it('lists me first, and only leaders get the tools for the others', async () => {
    await givenIAmOnTheRosterOf({ ...MOON_SCANS, myRoles: ['TRANSLATOR'] }, [{ username: 'mina', roles: ['LEADER'] }, { username: 'reader', roles: ['TRANSLATOR'] }]);

    thenTheMembersAre(['reader', 'mina']);
    thenICanLeave();
    thenThereIsNoButton('Change roles of mina');
    thenThereIsNoButton('Remove mina from the team');
  });

  async function givenIAmOnTheRosterOf(team: MyTeam, members: Member[]): Promise<void> {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    fixture = TestBed.createComponent(TeamRoster);
    fixture.componentRef.setInput('team', team);
    await settle(fixture);
    answerTheRoster(members);
    await settle(fixture);
  }

  async function whenIGiveTheRoles(username: string, roles: ScanlationRole[], after: { rosterAfter: Member[] }): Promise<void> {
    button(`Change roles of ${username}`).click();
    fixture.detectChanges();
    const boxes = Array.from(fixture.nativeElement.querySelectorAll('.roles-editor input[type="checkbox"]') as NodeListOf<HTMLInputElement>);
    const labels = boxes.map((box) => box.parentElement!.textContent!.trim());
    for (const [index, box] of boxes.entries()) {
      const wanted = roles.some((role) => labels[index] === ROLE_LABEL[role]);
      if (box.checked !== wanted) {
        box.click();
      }
    }
    fixture.detectChanges();
    button('Save the roles').click();
    await settle(fixture);
    lastRequest = http.expectOne(`${API}/teams/t-1/members/${username}`);
    lastRequest.flush(ok(MOON_SCANS));
    await settle(fixture);
    answerTheRoster(after.rosterAfter);
    await settle(fixture);
  }

  async function whenIRemove(username: string, after: { rosterAfter: Member[] }): Promise<void> {
    button(`Remove ${username} from the team`).click();
    await settle(fixture);
    lastRequest = http.expectOne((request) => request.method === 'DELETE');
    lastRequest.flush(ok(MOON_SCANS));
    await settle(fixture);
    answerTheRoster(after.rosterAfter);
    await settle(fixture);
  }

  function answerTheRoster(members: Member[]): void {
    http.expectOne(`${API}/teams/t-1`).flush(ok({ id: 't-1', name: 'Moon Scans', description: null, series: [], members, latestChapters: [], followers: 0, following: false }));
  }

  function thenTheRequestWas(method: string, url: string, body: unknown): void {
    expect(lastRequest.request.method).toBe(method);
    expect(lastRequest.request.url).toBe(url);
    expect(lastRequest.request.body).toEqual(body);
  }

  function thenTheRosterShows(username: string, roles: string[]): void {
    const row = rows().find((li) => li.querySelector('.member-name')!.textContent!.includes(username))!;
    expect(Array.from(row.querySelectorAll('.badge')).map((badge) => badge.textContent!.trim())).toEqual(roles);
  }

  function thenTheMembersAre(usernames: string[]): void {
    expect(rows().map((li) => li.querySelector('.member-name')!.firstChild!.textContent!.trim())).toEqual(usernames);
  }

  function thenTheFocusIsOn(heading: string): void {
    expect(document.activeElement?.textContent?.trim()).toBe(heading);
  }

  function thenICanLeave(): void {
    expect(button('Leave the team')).toBeDefined();
  }

  function thenThereIsNoButton(label: string): void {
    expect(button(label)).toBeUndefined();
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.roster > li'));
  }

  /** By accessible text: visible label plus any `.sr-only` part. */
  function button(label: string): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent!.replace(/\s+/g, ' ').trim() === label)!;
  }
});

const ROLE_LABEL: Record<ScanlationRole, string> = {
  LEADER: 'Leader',
  CLEANER_REDRAWER: 'Cleaner',
  TRANSLATOR: 'Translator',
  TYPESETTER: 'Typesetter',
  PROOFREADER: 'Proofreader',
  QUALITY_CHECKER: 'Quality checker'
};
