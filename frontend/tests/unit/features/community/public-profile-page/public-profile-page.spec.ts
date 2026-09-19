import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PublicProfilePage } from '@app/features/community/public-profile-page/public-profile-page';
import { WorkSummary } from '@app/core/models/readora.models';
import { API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

interface ReaderStats {
  chaptersRead: number;
  favouriteGenres: string[];
  completedSeries: Pick<WorkSummary, 'id' | 'title'>[];
}

describe('PublicProfilePage (US-12)', () => {
  let fixture: ComponentFixture<PublicProfilePage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicProfilePage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows chapters read, favourite genres and completed series', async () => {
    await whenIOpenTheProfileOf('kenji', {
      chaptersRead: 120,
      favouriteGenres: ['Action', 'Fantasy', 'Romance'],
      completedSeries: [{ id: 'w-2', title: 'Horimiya' }]
    });

    thenICanSee('120');
    thenICanSee('Action, Fantasy, Romance');
    thenTheCompletedSeriesLinksTo('/works/w-2');
  });

  it('says when the reader does not exist', async () => {
    await whenIOpenTheProfileOfAnUnknownReader('kenji');

    thenTheAlertSays('This reader could not be found.');
  });

  async function whenIOpenTheProfileOf(username: string, stats: ReaderStats): Promise<void> {
    await openTheProfile(username);
    http.expectOne(`${API}/users/${username}/profile`).flush(
      ok({
        username,
        displayName: 'Kenji',
        bio: '',
        joinedAt: '2026-01-01T00:00:00Z',
        chaptersRead: stats.chaptersRead,
        favouriteGenres: stats.favouriteGenres,
        completedSeries: stats.completedSeries.map((s) => ({ ...s, type: 'MANGA', status: 'COMPLETED', coverImageUrl: '', genres: [] }))
      })
    );
    await settle(fixture);
  }

  async function whenIOpenTheProfileOfAnUnknownReader(username: string): Promise<void> {
    await openTheProfile(username);
    http.expectOne(`${API}/users/${username}/profile`).flush(fail('not found'), { status: 404, statusText: 'Not Found' });
    await settle(fixture);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenTheCompletedSeriesLinksTo(href: string): void {
    expect(fixture.nativeElement.querySelector('.plain-list a').getAttribute('href')).toBe(href);
  }

  function thenTheAlertSays(message: string): void {
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
  }

  async function openTheProfile(username: string): Promise<void> {
    fixture = TestBed.createComponent(PublicProfilePage);
    fixture.componentRef.setInput('username', username);
    await settle(fixture);
  }
});
