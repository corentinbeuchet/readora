import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { UpdatesPage } from '@app/features/discovery/updates-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { Release } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';

const API = environment.apiUrl;

function release(id: string, title: string, number: string, minutesAgo: number, read = false): Release {
  return {
    work: { id: `w-${title}`, title, type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: [] },
    chapterId: id,
    chapterNumber: number,
    chapterTitle: '',
    publishedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    read
  };
}

describe('UpdatesPage (US-08)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'updates', component: UpdatesPage }], withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await Promise.resolve();
      harness.detectChanges();
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    harness.detectChanges();
  }

  async function open(url: string, releases: Release[], mine: boolean): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    const req = http.expectOne((r) => r.url === `${API}/updates`);
    expect(req.request.params.get('mine')).toBe(String(mine));
    req.flush({ success: true, data: releases, error: null });
    await settle();
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
    await settle();
    http.expectOne((r) => r.url === `${API}/updates`).flush({ success: false, data: null, error: 'down' });
    await settle();
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle();
    http.expectOne((r) => r.url === `${API}/updates`).flush({ success: true, data: [], error: null });
    await settle();
    expect(el().textContent).toContain('No chapters have been published yet.');
  });
});
