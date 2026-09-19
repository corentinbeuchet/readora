import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TeamPage } from '@app/features/community/team-page/team-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { TeamProfile } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting, settle } from '../../../test-utils';

const TEAM: TeamProfile = {
  id: 't-1',
  name: 'Shadow Scans',
  series: { id: 'w-1', title: 'Solo Leveling', type: 'MANHWA', status: 'ONGOING', coverImageUrl: '', genres: [] },
  members: [{ username: 'leader', roles: ['LEADER'] }, { username: 'translator', roles: ['TRANSLATOR'] }],
  latestChapters: [{ id: 'c-5', workId: 'w-1', chapterNumber: '5', title: 'Arise', status: 'PUBLISHED', pageCount: 20 }],
  followers: 3,
  following: false
};

describe('TeamPage (US-12)', () => {
  let fixture: ComponentFixture<TeamPage>;
  let http: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows the members, the series and the latest chapters', async () => {
    await givenIAmOnTheTeamPageOf(TEAM);

    thenICanSee('Shadow Scans');
    thenICanSee('3 followers');
    thenThereIsALinkTo('/works/w-1');
    thenThereIsALinkTo('/u/leader');
    thenThereIsALinkTo('/read/c-5');
  });

  it('follows and unfollows the team', async () => {
    await givenIAmOnTheTeamPageOf({ ...TEAM, followers: 3, following: false });

    await whenIClickFollow({ nowFollowing: true });

    thenTheFollowButtonSays('Following');
    thenTheFollowButtonIsPressed();
    thenICanSee('4 followers');

    await whenIClickFollow({ nowFollowing: false });

    thenTheRequestMethodWas('DELETE');
    thenTheFollowButtonSays('Follow');
  });

  /** Signed in with LIBRARY_USE, so the follow button is there. */
  async function givenIAmOnTheTeamPageOf(team: TeamProfile): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    fixture = TestBed.createComponent(TeamPage);
    fixture.componentRef.setInput('projectId', team.id);
    await settle(fixture);
    http.expectOne(`${API}/teams/${team.id}`).flush(ok(team));
    await settle(fixture);
  }

  async function whenIClickFollow(answer: { nowFollowing: boolean }): Promise<void> {
    followButton().click();
    lastRequest = http.expectOne(`${API}/teams/t-1/follow`);
    lastRequest.flush(ok({ following: answer.nowFollowing }));
    await settle(fixture);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenThereIsALinkTo(href: string): void {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>).map((a) => a.getAttribute('href'));
    expect(links).toContain(href);
  }

  function thenTheFollowButtonSays(label: string): void {
    expect(followButton().textContent!.trim()).toBe(label);
  }

  function thenTheFollowButtonIsPressed(): void {
    expect(followButton().getAttribute('aria-pressed')).toBe('true');
  }

  function thenTheRequestMethodWas(method: string): void {
    expect(lastRequest.request.method).toBe(method);
  }

  function followButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.profile-header button');
  }
});
