import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { UpdatesPage } from '@app/features/discovery/updates-page/updates-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { Release } from '@app/core/models/discovery';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, FIXED_NOW, fail, freezeDate, ok, provideHttpTesting, settle } from '../../../test-utils';

function release(id: string, title: string, number: string, minutesAgo: number, read = false, chapterTitle = ''): Release {
  return {
    work: { id: `w-${title}`, title, type: 'MANGA', status: 'ONGOING', author: null, demographic: null, coverImageUrl: '', coverThumbnailUrl: null, genres: [] },
    team: { id: 't-shadow', name: 'Shadow Scans' },
    chapterId: id,
    chapterNumber: number,
    chapterTitle,
    publishedAt: new Date(FIXED_NOW.getTime() - minutesAgo * 60_000).toISOString(),
    read
  };
}

/** Model for routed-page tests: given/when/then methods (frontend-component-tests skill). */
describe('UpdatesPage (US-08)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let feedRequest: TestRequest;

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

  it('lists the newest chapters with their age and a Read now link; guests get no "My library" tab', async () => {
    await givenIOpenTheUpdates('/updates');

    await whenTheFeedAnswers([release('op-180', 'One Piece', '180', 10), release('sl-6', 'Solo Leveling', '6', 120)]);

    thenTheFeedWasAskedFor({ mine: false });
    thenReleaseShows(1, 'One Piece', '10 minutes ago');
    thenReleaseLinksTo(1, '/read/op-180');
    thenReleaseIsCreditedTo(1, 'Shadow Scans', '/teams/t-shadow');
    thenThereIsNoFeedChoice();
  });

  it('shows a chapter title only when it says more than the chapter number', async () => {
    await givenIOpenTheUpdates('/updates');

    await whenTheFeedAnswers([release('sl-6', 'Solo Leveling', '6', 5, false, 'Chapter 6'), release('op-1', 'One Piece', '1', 9, false, 'Romance Dawn')]);

    thenReleaseLineIs(1, 'Chapter 6');
    thenReleaseLineIs(2, 'Chapter 1 Romance Dawn');
  });

  it('shows only my library with read badges when "My library" is chosen', async () => {
    await givenIAmSignedInWithALibrary();
    await givenIOpenTheUpdates('/updates?feed=mine');

    await whenTheFeedAnswers([release('sl-6', 'Solo Leveling', '6', 5), release('sl-5', 'Solo Leveling', '5', 60, true)]);

    thenTheFeedWasAskedFor({ mine: true });
    thenTheSelectedFeedIs('My library');
    thenReleaseIsMarkedRead(2);
    thenReleaseIsNotMarkedRead(1);
  });

  it('offers a retry when the feed fails', async () => {
    await givenIOpenTheUpdates('/updates');
    await givenTheFeedFails();

    await whenIRetry();
    await whenTheFeedAnswers([]);

    thenICanSee('No chapters have been published yet.');
  });

  async function givenIAmSignedInWithALibrary(): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
  }

  /** Opens `url` through the real router; the feed request stays pending until a `whenTheFeed…` answers it. */
  async function givenIOpenTheUpdates(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle(harness);
    feedRequest = http.expectOne((r) => r.url === `${API}/updates`);
  }

  async function givenTheFeedFails(): Promise<void> {
    feedRequest.flush(fail('down'));
    await settle(harness);
  }

  async function whenTheFeedAnswers(releases: Release[]): Promise<void> {
    feedRequest.flush(ok(releases));
    await settle(harness);
  }

  async function whenIRetry(): Promise<void> {
    page().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(harness);
    feedRequest = http.expectOne((r) => r.url === `${API}/updates`);
  }

  function thenTheFeedWasAskedFor(filter: { mine: boolean }): void {
    expect(feedRequest.request.params.get('mine')).toBe(String(filter.mine));
  }

  function thenReleaseShows(position: number, title: string, age: string): void {
    expect(releaseRow(position).textContent).toContain(title);
    expect(releaseRow(position).textContent).toContain(age);
  }

  function thenReleaseIsCreditedTo(position: number, team: string, href: string): void {
    const link = releaseRow(position).querySelector('a.release-team')!;
    expect(link.textContent).toContain(team);
    expect(link.getAttribute('href')).toBe(href);
  }

  function thenReleaseLinksTo(position: number, href: string): void {
    expect(releaseRow(position).querySelector('a.btn[href^="/read/"]')!.getAttribute('href')).toBe(href);
  }

  function thenReleaseIsMarkedRead(position: number): void {
    expect(readBadge(position)?.textContent?.trim()).toBe('Read');
  }

  function thenReleaseIsNotMarkedRead(position: number): void {
    expect(readBadge(position)).toBeNull();
  }

  /** The "Read" badge of the release line (the card has its own type and status badges). */
  function readBadge(position: number): HTMLElement | null {
    return releaseRow(position).querySelector('[cardMeta] .badge');
  }

  function thenThereIsNoFeedChoice(): void {
    expect(page().querySelector('.feed-tabs')).toBeNull();
  }

  function thenTheSelectedFeedIs(label: string): void {
    expect(page().querySelector('.tab[aria-current="page"]')!.textContent!.trim()).toBe(label);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function page(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  /** The chapter and its title, as the row's meta line shows them (team, age and badges left out). */
  function thenReleaseLineIs(position: number, expected: string): void {
    const parts = Array.from(releaseRow(position).querySelectorAll('.release-line > span:not(.badge)')).map((part) => part.textContent!.trim());
    expect(parts.join(' ')).toBe(expected);
  }

  function releaseRow(position: number): HTMLElement {
    return page().querySelectorAll<HTMLElement>('app-work-card')[position - 1];
  }
});
