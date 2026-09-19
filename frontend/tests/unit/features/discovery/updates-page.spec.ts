import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { UpdatesPage } from '@app/features/discovery/updates-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { Release } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { API, FIXED_NOW, fail, freezeDate, ok, provideHttpTesting, settle } from '../../test-utils';

function release(id: string, title: string, number: string, minutesAgo: number, read = false): Release {
  return {
    work: { id: `w-${title}`, title, type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: [] },
    chapterId: id,
    chapterNumber: number,
    chapterTitle: '',
    publishedAt: new Date(FIXED_NOW.getTime() - minutesAgo * 60_000).toISOString(),
    read
  };
}

/** Given/When/Then model for routed-page tests (see the frontend-component-tests skill). */
describe('UpdatesPage (US-08)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    // "10 minutes ago" must not depend on how long the run takes.
    freezeDate();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'updates', component: UpdatesPage }], withComponentInputBinding()), ...provideHttpTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const el = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const rows = (): HTMLElement[] => Array.from(el().querySelectorAll('.release'));

  /** Opens `url` through the real router; returns the feed request, still unanswered, so the test decides the answer. */
  async function givenUpdatesPageAt(url: string): Promise<TestRequest> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle(harness);
    return http.expectOne((r) => r.url === `${API}/updates`);
  }

  async function whenFeedAnswers(request: TestRequest, releases: Release[]): Promise<void> {
    request.flush(ok(releases));
    await settle(harness);
  }

  it('lists the newest chapters with their age and a Read now link; guests get no "My library" tab', async () => {
    // Given
    const feed = await givenUpdatesPageAt('/updates');

    // When
    await whenFeedAnswers(feed, [release('op-180', 'One Piece', '180', 10), release('sl-6', 'Solo Leveling', '6', 120)]);

    // Then
    expect(feed.request.params.get('mine')).toBe('false');
    expect(rows()[0].textContent).toContain('One Piece');
    expect(rows()[0].textContent).toContain('10 minutes ago');
    expect(rows()[0].querySelector<HTMLAnchorElement>('a.btn-primary')!.getAttribute('href')).toBe('/read/op-180');
    expect(el().querySelector('.feed-tabs')).toBeNull();
  });

  it('shows only my library with read badges when "My library" is chosen', async () => {
    // Given
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    const feed = await givenUpdatesPageAt('/updates?feed=mine');

    // When
    await whenFeedAnswers(feed, [release('sl-6', 'Solo Leveling', '6', 5), release('sl-5', 'Solo Leveling', '5', 60, true)]);

    // Then
    expect(feed.request.params.get('mine')).toBe('true');
    expect(el().querySelector('.tab[aria-current="page"]')!.textContent!.trim()).toBe('My library');
    expect(rows()[1].classList).toContain('release-read');
    expect(rows()[1].textContent).toContain('Read');
    expect(rows()[0].querySelector('.badge')).toBeNull();
  });

  it('offers a retry when the feed fails', async () => {
    // Given
    const failing = await givenUpdatesPageAt('/updates');
    failing.flush(fail('down'));
    await settle(harness);

    // When
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(harness);
    await whenFeedAnswers(http.expectOne((r) => r.url === `${API}/updates`), []);

    // Then
    expect(el().textContent).toContain('No chapters have been published yet.');
  });
});
