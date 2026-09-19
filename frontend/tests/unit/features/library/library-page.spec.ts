import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LibraryPage } from '@app/features/library/library-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { LibraryItem } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';

const API = environment.apiUrl;
const READER = mockUser({ permissions: ['COMMENT_WRITE', 'LIBRARY_USE'] });

const SOLO: LibraryItem = {
  work: { id: 'w-1', title: 'Solo Leveling', type: 'MANHWA', status: 'COMPLETED', coverImageUrl: '', genres: [] },
  status: 'READING',
  addedAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-02T00:00:00Z',
  newChapters: 2,
  newChapterNotifications: true
};
const OMNI: LibraryItem = { ...SOLO, work: { ...SOLO.work, id: 'w-2', title: 'Omniscient Reader' }, status: 'PLAN_TO_READ', newChapters: 0 };

describe('LibraryPage (US-05 My library)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'library', component: LibraryPage }], withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    await signIn(TestBed.inject(AuthStore), http, READER);
    harness = await RouterTestingHarness.create();
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

  async function open(url: string, items: LibraryItem[], expectedStatus: string | null = null): Promise<void> {
    await harness.navigateByUrl(url);
    await settle();
    const request = http.expectOne((r) => r.url === `${API}/library`);
    expect(request.request.params.get('status')).toBe(expectedStatus);
    request.flush({ success: true, data: items, error: null });
    await settle();
  }

  it('lists my series with their status and a "2 new" badge', async () => {
    await open('/library', [SOLO, OMNI]);

    const rows = el().querySelectorAll('.library-item');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Solo Leveling');
    expect(rows[0].querySelector('.badge-new')?.textContent).toContain('2 new');
    expect(rows[1].querySelector('.badge-new')).toBeNull();
    expect(rows[1].querySelector<HTMLSelectElement>('select')!.value).toBe('PLAN_TO_READ');
  });

  it('filters by status from the URL and marks the current tab', async () => {
    await open('/library?status=PLAN_TO_READ', [OMNI], 'PLAN_TO_READ');

    expect(el().querySelector('.tab[aria-current="page"]')?.textContent?.trim()).toBe('Plan to read');
  });

  it('changes a status and removes a series, then reloads the list', async () => {
    await open('/library', [SOLO]);

    const select = el().querySelector<HTMLSelectElement>('select')!;
    select.value = 'COMPLETED';
    select.dispatchEvent(new Event('change'));
    const save = http.expectOne(`${API}/library/w-1`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ status: 'COMPLETED' });
    save.flush({ success: true, data: { workId: 'w-1', status: 'COMPLETED', addedAt: '', updatedAt: '' }, error: null });
    await settle();
    http.expectOne((r) => r.url === `${API}/library`).flush({ success: true, data: [{ ...SOLO, status: 'COMPLETED' }], error: null });
    await settle();

    el().querySelector<HTMLButtonElement>('.library-actions button')!.click();
    const remove = http.expectOne(`${API}/library/w-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    http.expectOne((r) => r.url === `${API}/library`).flush({ success: true, data: [], error: null });
    await settle();

    expect(el().textContent).toContain('Your library is empty.');
  });

  it('shows why an update failed and keeps the list', async () => {
    await open('/library', [SOLO]);

    el().querySelector<HTMLButtonElement>('.library-actions button')!.click();
    http.expectOne(`${API}/library/w-1`).flush({ success: false, data: null, error: 'Series not found' }, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Series not found');
    expect(el().querySelectorAll('.library-item')).toHaveLength(1);
  });

  it('shows an error with a retry when the library cannot be loaded', async () => {
    await harness.navigateByUrl('/library');
    await settle();
    http.expectOne((r) => r.url === `${API}/library`).flush({ success: false, data: null, error: 'down' });
    await settle();

    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle();
    http.expectOne((r) => r.url === `${API}/library`).flush({ success: true, data: [SOLO], error: null });
    await settle();
    expect(el().querySelectorAll('.library-item')).toHaveLength(1);
  });

  it('turns new chapter alerts off for one series', async () => {
    await open('/library', [SOLO]);

    const toggle = el().querySelector<HTMLInputElement>('.notify-toggle input')!;
    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    const req = http.expectOne(`${API}/library/w-1/notifications`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush({ success: true, data: { enabled: false }, error: null });
    await settle();
    http.expectOne((r) => r.url === `${API}/library`).flush({ success: true, data: [{ ...SOLO, newChapterNotifications: false }], error: null });
    await settle();

    expect(el().querySelector<HTMLInputElement>('.notify-toggle input')!.checked).toBe(false);
  });

  it('downloads the library as a CSV file', async () => {
    await open('/library', [SOLO]);
    const page = harness.routeDebugElement!.componentInstance as { saveFile: (file: Blob, name: string) => void };
    const saved = vi.spyOn(page, 'saveFile').mockImplementation(() => undefined);

    el().querySelector<HTMLButtonElement>('.export button')!.click();
    const req = http.expectOne((r) => r.url === `${API}/library/export`);
    expect(req.request.params.get('format')).toBe('csv');
    req.flush(new Blob(['title,status,last_chapter_read\n']));
    await settle();

    expect(saved).toHaveBeenCalledWith(expect.any(Blob), 'readora-library.csv');
  });
});

