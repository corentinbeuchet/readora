import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LibraryPage } from '@app/features/library/library-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { LibraryItem } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../test-utils';

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
  let lastRequest: TestRequest;
  let saveFile: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'library', component: LibraryPage }], withComponentInputBinding()), ...provideHttpTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  it('lists my series with their status and a "2 new" badge', async () => {
    await whenIOpen('/library', { library: [SOLO, OMNI] });

    thenMyLibraryWasAskedFor({ status: null });
    thenIHaveSeriesListed(2);
    thenRowShows(1, 'Solo Leveling');
    thenRowHasTheBadge(1, '2 new');
    thenRowHasNoBadge(2);
    thenRowStatusIs(2, 'PLAN_TO_READ');
  });

  it('filters by status from the URL and marks the current tab', async () => {
    await whenIOpen('/library?status=PLAN_TO_READ', { library: [OMNI] });

    thenMyLibraryWasAskedFor({ status: 'PLAN_TO_READ' });
    thenTheSelectedTabIs('Plan to read');
  });

  it('changes a status and removes a series, then reloads the list', async () => {
    await givenIAmOnMyLibrary([SOLO]);

    await whenIChangeTheStatusOf(SOLO, 'COMPLETED', { reloaded: [{ ...SOLO, status: 'COMPLETED' }] });

    thenTheRequestWas('PUT', { status: 'COMPLETED' });

    await whenIRemove(SOLO, { reloaded: [] });

    thenTheRequestWas('DELETE');
    thenICanSee('Your library is empty.');
  });

  it('shows why an update failed and keeps the list', async () => {
    await givenIAmOnMyLibrary([SOLO]);

    await whenIRemove(SOLO, { error: 'Series not found' });

    thenTheAlertSays('Series not found');
    thenIHaveSeriesListed(1);
  });

  it('shows an error with a retry when the library cannot be loaded', async () => {
    await givenMyLibraryFailsToLoad();

    await whenIRetry({ library: [SOLO] });

    thenIHaveSeriesListed(1);
  });

  it('turns new chapter alerts off for one series', async () => {
    await givenIAmOnMyLibrary([SOLO]);
    thenNewChapterAlertsAreOn(SOLO, true);

    await whenITurnOffNewChapterAlertsFor(SOLO, { reloaded: [{ ...SOLO, newChapterNotifications: false }] });

    thenTheRequestWas('PUT', { enabled: false });
    thenNewChapterAlertsAreOn(SOLO, false);
  });

  it('downloads the library as a CSV file', async () => {
    await givenIAmOnMyLibrary([SOLO]);

    await whenIDownloadMyLibraryAs('csv');

    thenTheExportWasAskedFor('csv');
    thenAFileWasSavedAs('readora-library.csv');
  });

  /** The whole library ("All" tab): the request must not filter by status. */
  async function givenIAmOnMyLibrary(library: LibraryItem[]): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, READER);
    await harness.navigateByUrl('/library');
    await settle(harness);
    http.expectOne((r) => r.url === `${API}/library` && r.params.get('status') === null).flush(ok(library));
    await settle(harness);
  }

  async function givenMyLibraryFailsToLoad(): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, READER);
    await harness.navigateByUrl('/library');
    await settle(harness);
    libraryRequest().flush(fail('down'));
    await settle(harness);
  }

  async function whenIOpen(url: string, answer: { library: LibraryItem[] }): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, READER);
    await harness.navigateByUrl(url);
    await settle(harness);
    lastRequest = libraryRequest();
    lastRequest.flush(ok(answer.library));
    await settle(harness);
  }

  async function whenIChangeTheStatusOf(series: LibraryItem, status: string, answer: { reloaded: LibraryItem[] }): Promise<void> {
    const select = row(series).querySelector<HTMLSelectElement>('select')!;
    select.value = status;
    select.dispatchEvent(new Event('change'));
    lastRequest = http.expectOne(`${API}/library/${series.work.id}`);
    lastRequest.flush(ok({ workId: series.work.id, status, addedAt: '', updatedAt: '' }));
    await answerTheReload(answer.reloaded);
  }

  /** `error` is answered with a 404, the list is then not reloaded. */
  async function whenIRemove(series: LibraryItem, answer: { reloaded: LibraryItem[] } | { error: string }): Promise<void> {
    row(series).querySelector<HTMLButtonElement>('.library-actions button')!.click();
    lastRequest = http.expectOne(`${API}/library/${series.work.id}`);
    if ('error' in answer) {
      lastRequest.flush(fail(answer.error), { status: 404, statusText: 'Not Found' });
      await settle(harness);
    } else {
      lastRequest.flush(null, { status: 204, statusText: 'No Content' });
      await answerTheReload(answer.reloaded);
    }
  }

  async function whenIRetry(answer: { library: LibraryItem[] }): Promise<void> {
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(harness);
    libraryRequest().flush(ok(answer.library));
    await settle(harness);
  }

  async function whenITurnOffNewChapterAlertsFor(series: LibraryItem, answer: { reloaded: LibraryItem[] }): Promise<void> {
    const toggle = alertsToggle(series);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    lastRequest = http.expectOne(`${API}/library/${series.work.id}/notifications`);
    lastRequest.flush(ok({ enabled: false }));
    await answerTheReload(answer.reloaded);
  }

  /** `saveFile` is the page's browser side effect (a download), replaced so nothing is written. */
  async function whenIDownloadMyLibraryAs(format: string): Promise<void> {
    const page = harness.routeDebugElement!.componentInstance as { saveFile: (file: Blob, name: string) => void };
    saveFile = vi.spyOn(page, 'saveFile').mockImplementation(() => undefined);
    Array.from(el().querySelectorAll<HTMLButtonElement>('.export button')).find((b) => b.textContent?.includes(`Download ${format.toUpperCase()}`))!.click();
    lastRequest = http.expectOne((r) => r.url === `${API}/library/export`);
    lastRequest.flush(new Blob(['title,status,last_chapter_read\n']));
    await settle(harness);
  }

  function thenMyLibraryWasAskedFor(filter: { status: string | null }): void {
    expect(lastRequest.request.params.get('status')).toBe(filter.status);
  }

  function thenIHaveSeriesListed(count: number): void {
    expect(rows()).toHaveLength(count);
  }

  function thenRowShows(position: number, text: string): void {
    expect(rows()[position - 1].textContent).toContain(text);
  }

  function thenRowHasTheBadge(position: number, text: string): void {
    expect(rows()[position - 1].querySelector('.badge-new')?.textContent).toContain(text);
  }

  function thenRowHasNoBadge(position: number): void {
    expect(rows()[position - 1].querySelector('.badge-new')).toBeNull();
  }

  function thenRowStatusIs(position: number, status: string): void {
    expect(rows()[position - 1].querySelector<HTMLSelectElement>('select')!.value).toBe(status);
  }

  function thenTheSelectedTabIs(label: string): void {
    expect(el().querySelector('.tab[aria-current="page"]')?.textContent?.trim()).toBe(label);
  }

  function thenTheRequestWas(method: string, body?: unknown): void {
    expect(lastRequest.request.method).toBe(method);
    if (body !== undefined) expect(lastRequest.request.body).toEqual(body);
  }

  function thenICanSee(text: string): void {
    expect(el().textContent).toContain(text);
  }

  function thenTheAlertSays(message: string): void {
    expect(el().querySelector('[role="alert"]')?.textContent).toContain(message);
  }

  function thenNewChapterAlertsAreOn(series: LibraryItem, on: boolean): void {
    expect(alertsToggle(series).checked).toBe(on);
  }

  function thenTheExportWasAskedFor(format: string): void {
    expect(lastRequest.request.params.get('format')).toBe(format);
  }

  function thenAFileWasSavedAs(name: string): void {
    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), name);
  }

  /** After a write the page reloads the list; `lastRequest` stays the write. */
  async function answerTheReload(library: LibraryItem[]): Promise<void> {
    await settle(harness);
    libraryRequest().flush(ok(library));
    await settle(harness);
  }

  function libraryRequest(): TestRequest {
    return http.expectOne((r) => r.url === `${API}/library`);
  }

  function el(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function rows(): HTMLElement[] {
    return Array.from(el().querySelectorAll<HTMLElement>('.library-item'));
  }

  function row(series: LibraryItem): HTMLElement {
    return rows().find((r) => r.textContent?.includes(series.work.title))!;
  }

  function alertsToggle(series: LibraryItem): HTMLInputElement {
    return row(series).querySelector<HTMLInputElement>('.notify-toggle input')!;
  }
});
