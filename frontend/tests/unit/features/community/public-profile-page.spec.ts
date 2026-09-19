import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PublicProfilePage } from '@app/features/community/public-profile-page';
import { API, fail, ok, provideHttpTesting, settle } from '../../test-utils';

describe('PublicProfilePage (US-12)', () => {
  let fixture: ComponentFixture<PublicProfilePage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicProfilePage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicProfilePage);
    fixture.componentRef.setInput('username', 'kenji');
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('shows chapters read, favourite genres and completed series', async () => {
    http.expectOne(`${API}/users/kenji/profile`).flush(ok({
        username: 'kenji', displayName: 'Kenji', bio: '', joinedAt: '2026-01-01T00:00:00Z', chaptersRead: 120,
        favouriteGenres: ['Action', 'Fantasy', 'Romance'],
        completedSeries: [{ id: 'w-2', title: 'Horimiya', type: 'MANGA', status: 'COMPLETED', coverImageUrl: '', genres: [] }]
      }));
    await settle(fixture);

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('120');
    expect(text).toContain('Action, Fantasy, Romance');
    expect(fixture.nativeElement.querySelector('.plain-list a').getAttribute('href')).toBe('/works/w-2');
  });

  it('says when the reader does not exist', async () => {
    http.expectOne(`${API}/users/kenji/profile`).flush(fail('not found'), { status: 404, statusText: 'Not Found' });
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('This reader could not be found.');
  });
});
