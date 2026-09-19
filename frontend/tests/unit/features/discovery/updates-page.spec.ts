import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
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

  async function open(url: string, releases: Release[], mine: boolean): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle(harness);
    const req = http.expectOne((r) => r.url === `${API}/updates`);
    expect(req.request.params.get('mine')).toBe(String(mine));
    req.flush(ok(releases));
    await settle(harness);
  }

  it('lists the newest chapters with their age and a Read now link; guests get no "My library" tab', async () => {
    await open('/updates', [release('op-180', 'One Piece', '180', 10), release('sl-6', 'Solo Leveling', '6', 120)], false);

    const rows = el().querySelectorAll('.release');
    expect(rows[0].textContent).toContain('One Piece');
    expect(rows[0].textContent).toContain('10 minutes ago');
    expect(rows[0].querySelector<HTMLAnchorElement>('a.btn-primary')!.getAttribute('href')).toBe('/read/op-180');
    expect(el().querySelector('.feed-tabs')).toBeNull();
  });

  it('shows only my library with read badges when "My library" is chosen', async () => {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    await open('/updates?feed=mine', [release('sl-6', 'Solo Leveling', '6', 5), release('sl-5', 'Solo Leveling', '5', 60, true)], true);

    expect(el().querySelector('.tab[aria-current="page"]')!.textContent!.trim()).toBe('My library');
    const rows = el().querySelectorAll('.release');
    expect(rows[1].classList).toContain('release-read');
    expect(rows[1].textContent).toContain('Read');
    expect(rows[0].querySelector('.badge')).toBeNull();
  });

  it('offers a retry when the feed fails', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/updates');
    await settle(harness);
    http.expectOne((r) => r.url === `${API}/updates`).flush(fail('down'));
    await settle(harness);
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(harness);
    http.expectOne((r) => r.url === `${API}/updates`).flush(ok([]));
    await settle(harness);
    expect(el().textContent).toContain('No chapters have been published yet.');
  });
});
