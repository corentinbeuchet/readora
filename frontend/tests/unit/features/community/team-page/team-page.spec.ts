import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TeamPage } from '@app/features/community/team-page/team-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { WorkSummary } from '@app/core/models/catalog';
import { PagedResponse } from '@app/core/models/api';
import { TeamProfile, TeamSeries } from '@app/core/models/community';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting, settle } from '../../../test-utils';

const SHADOW_SCANS = { id: 't-1', name: 'Shadow Scans' };

const TEAM: TeamProfile = {
  id: 't-1',
  name: 'Shadow Scans',
  description: 'We translate action series.',
  series: onePage([
    { work: series('w-1', 'Solo Leveling'), chapterCount: 2 },
    { work: series('w-2', 'Omniscient Reader'), chapterCount: 1 }
  ]),
  members: [{ username: 'leader', roles: ['LEADER'] }, { username: 'translator', roles: ['TRANSLATOR'] }],
  latestChapters: [
    { id: 'c-5', workId: 'w-1', chapterNumber: '5', title: 'Arise', status: 'PUBLISHED', pageCount: 20, publishedAt: null, team: SHADOW_SCANS },
    { id: 'c-9', workId: 'w-2', chapterNumber: '1', title: 'Prologue', status: 'PUBLISHED', pageCount: 30, publishedAt: null, team: SHADOW_SCANS }
  ],
  latestSeries: [{ id: 'w-1', title: 'Solo Leveling' }, { id: 'w-2', title: 'Omniscient Reader' }],
  followers: 3,
  following: false
};

function onePage(items: TeamSeries[], page = 0, totalElements = items.length): PagedResponse<TeamSeries> {
  return { items, page, size: 24, totalElements, totalPages: Math.ceil(totalElements / 24) };
}

/** `count` series from "Series <from>" on, with no chapter. */
function quietSeries(from: number, count: number): TeamSeries[] {
  return Array.from({ length: count }, (_, i) => ({ work: series(`w-q${from + i}`, `Series ${from + i}`), chapterCount: 0 }));
}

function series(id: string, title: string): WorkSummary {
  return { id, title, type: 'MANHWA', status: 'ONGOING', author: null, demographic: null, coverImageUrl: '', coverThumbnailUrl: null, genres: [] };
}

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

  it('shows the description, the members and the latest chapters with their series', async () => {
    await givenIAmOnTheTeamPageOf(TEAM);

    thenICanSee('Shadow Scans');
    thenICanSee('We translate action series.');
    thenICanSee('3 followers');
    thenThereIsALinkTo('/u/leader');
    thenICanSee('Translator');
    thenTheLatestChaptersAre(['Solo Leveling, chapter 5', 'Omniscient Reader, chapter 1']);
    thenThereIsALinkTo('/read/c-9');
  });

  it('leaves out a chapter title that only repeats its number', async () => {
    await givenIAmOnTheTeamPageOf({
      ...TEAM,
      latestChapters: [{ id: 'c-3', workId: 'w-1', chapterNumber: '3', title: 'Chapter 3', status: 'PUBLISHED', pageCount: 20, publishedAt: null, team: SHADOW_SCANS }]
    });

    thenTheLatestChapterTitlesAre([]);
  });

  it('each series is a card with the number of chapters the team published', async () => {
    await givenIAmOnTheTeamPageOf(TEAM);

    thenTheSeriesCardsLinkTo(['/works/w-1', '/works/w-2']);
    thenTheSeriesCardSays('Solo Leveling', '2 chapters');
    thenTheSeriesCardSays('Omniscient Reader', '1 chapter');
    thenThereIsNoPager();
  });

  it('The team page lists its series as cards, 24 per page', async () => {
    await givenIAmOnTheTeamPageOf({ ...TEAM, series: onePage(quietSeries(1, 24), 0, 30) });

    thenThereAreSeriesCards(24);
    thenTheSeriesCardSays('Series 1', 'No chapter yet');
    thenICanSee('Page 1 / 2');
    thenTheNextPageLinkGoesTo('page=1');

    await whenIOpenPageOfItsSeries(1, onePage(quietSeries(25, 6), 1, 30));

    thenThereAreSeriesCards(6);
    thenICanSee('Page 2 / 2');
    thenICanSee('Shadow Scans');
  });

  it('a team without a series says so and points to the catalog', async () => {
    await givenIAmOnTheTeamPageOf({ ...TEAM, series: onePage([]), latestChapters: [], latestSeries: [] });

    thenICanSee('This team has not started a series yet.');
    thenThereIsALinkTo('/works');
    thenICanSee('No chapters published yet.');
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
    fixture.componentRef.setInput('teamId', team.id);
    await settle(fixture);
    http.expectOne(`${API}/teams/${team.id}`).flush(ok(team));
    await settle(fixture);
  }

  /** What the router does for `?page=`: the input changes, the page asks for that page of series. */
  async function whenIOpenPageOfItsSeries(page: number, answer: PagedResponse<TeamSeries>): Promise<void> {
    fixture.componentRef.setInput('page', String(page));
    await settle(fixture);
    http.expectOne(`${API}/teams/t-1?page=${page}`).flush(ok({ ...TEAM, series: answer }));
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

  function thenTheLatestChapterTitlesAre(titles: string[]): void {
    const shown: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.latest-chapter .muted'));
    expect(shown.map((span) => span.textContent!.trim())).toEqual(titles);
  }

  function thenTheLatestChaptersAre(labels: string[]): void {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('.latest-chapter a'));
    expect(links.map((a) => a.textContent!.trim())).toEqual(labels);
  }

  function thenTheSeriesCardsLinkTo(hrefs: string[]): void {
    expect(seriesCards().map((card) => card.querySelector('a')?.getAttribute('href'))).toEqual(hrefs);
  }

  function thenThereAreSeriesCards(count: number): void {
    expect(seriesCards()).toHaveLength(count);
  }

  function thenThereIsNoPager(): void {
    expect(fixture.nativeElement.querySelector('nav.pager')).toBeNull();
  }

  function thenTheNextPageLinkGoesTo(query: string): void {
    const next = Array.from(fixture.nativeElement.querySelectorAll('nav.pager a') as NodeListOf<HTMLAnchorElement>).find((a) => a.textContent!.includes('Next'));
    expect(next?.getAttribute('href')).toContain(query);
  }

  function thenTheSeriesCardSays(title: string, text: string): void {
    expect(seriesCards().find((card) => card.textContent!.includes(title))?.textContent).toContain(text);
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

  function seriesCards(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('section[aria-labelledby="team-series"] app-work-card'));
  }

  function followButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.profile-header button');
  }
});
