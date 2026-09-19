import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TeamPageComponent } from '@app/features/community/team-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { TeamPage } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { settle } from '../../test-utils';

const API = environment.apiUrl;
const TEAM: TeamPage = {
  id: 't-1',
  name: 'Shadow Scans',
  series: { id: 'w-1', title: 'Solo Leveling', type: 'MANHWA', status: 'ONGOING', coverImageUrl: '', genres: [] },
  members: [{ username: 'leader', roles: ['LEADER'] }, { username: 'translator', roles: ['TRANSLATOR'] }],
  latestChapters: [{ id: 'c-5', workId: 'w-1', chapterNumber: '5', title: 'Arise', status: 'PUBLISHED', pageCount: 20 }],
  followers: 3,
  following: false
};

describe('TeamPage (US-12)', () => {
  let fixture: ComponentFixture<TeamPageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    fixture = TestBed.createComponent(TeamPageComponent);
    fixture.componentRef.setInput('projectId', 't-1');
    await settle(fixture);
    http.expectOne(`${API}/teams/t-1`).flush({ success: true, data: TEAM, error: null });
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('shows the members, the series and the latest chapters', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Shadow Scans');
    expect(text).toContain('3 followers');
    const links = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>).map((a) => a.getAttribute('href'));
    expect(links).toContain('/works/w-1');
    expect(links).toContain('/u/leader');
    expect(links).toContain('/read/c-5');
  });

  it('follows and unfollows the team', async () => {
    const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('.profile-header button');
    button().click();
    http.expectOne(`${API}/teams/t-1/follow`).flush({ success: true, data: { following: true }, error: null });
    await settle(fixture);
    expect(button().textContent!.trim()).toBe('Following');
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('4 followers');

    button().click();
    const req = http.expectOne(`${API}/teams/t-1/follow`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { following: false }, error: null });
    await settle(fixture);
    expect(button().textContent!.trim()).toBe('Follow');
  });
});
