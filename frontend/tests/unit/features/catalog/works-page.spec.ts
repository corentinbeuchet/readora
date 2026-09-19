import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { WorksPage } from '@app/features/catalog/works-page';
import { PagedResponse, WorkSummary } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';

const API = environment.apiUrl;

const SOLO: WorkSummary = {
  id: 'w-1',
  title: 'Solo Leveling',
  type: 'MANHWA',
  status: 'COMPLETED',
  author: 'Chugong',
  demographic: 'SHOUNEN',
  coverImageUrl: '',
  genres: ['Action', 'Fantasy']
};

function page(items: WorkSummary[]): PagedResponse<WorkSummary> {
  return { items, page: 0, size: 24, totalElements: items.length, totalPages: 1 };
}

describe('WorksPage (US-04 catalog filters)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'works', component: WorksPage }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const chip = (genre: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.chip')).find((b) => b.textContent?.includes(genre))!;

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await Promise.resolve();
      harness.detectChanges();
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    harness.detectChanges();
  }

  function worksRequest(): TestRequest {
    return http.expectOne((r) => r.url === `${API}/works`);
  }

  async function open(url: string, items: WorkSummary[] = [SOLO]): Promise<TestRequest> {
    await harness.navigateByUrl(url);
    await settle();
    http.expectOne(`${API}/works/genres`).flush({ success: true, data: ['Action', 'Fantasy', 'Romance'], error: null });
    const request = worksRequest();
    request.flush({ success: true, data: page(items), error: null });
    await settle();
    return request;
  }

  async function nextWorksRequest(items: WorkSummary[] = [SOLO]): Promise<TestRequest> {
    await settle();
    const request = worksRequest();
    request.flush({ success: true, data: page(items), error: null });
    await settle();
    return request;
  }

  it('Clicking a genre cycles between wanted, excluded and ignored', async () => {
    await open('/works');

    chip('Action').click();
    let request = await nextWorksRequest();
    expect(chip('Action').getAttribute('aria-label')).toBe('Action: wanted');
    expect(request.request.params.getAll('genre')).toEqual(['Action']);
    expect(request.request.params.has('excludeGenre')).toBe(false);

    chip('Action').click();
    request = await nextWorksRequest();
    expect(chip('Action').getAttribute('aria-label')).toBe('Action: excluded');
    expect(request.request.params.has('genre')).toBe(false);
    expect(request.request.params.getAll('excludeGenre')).toEqual(['Action']);

    chip('Action').click();
    request = await nextWorksRequest();
    expect(chip('Action').getAttribute('aria-label')).toBe('Action: not filtered');
    expect(request.request.params.has('genre')).toBe(false);
    expect(request.request.params.has('excludeGenre')).toBe(false);
  });

  it('reads every filter from the URL and sends it to the API', async () => {
    const request = await open('/works?q=solo&genre=Action&genre=Fantasy&excludeGenre=Romance&type=MANHWA&status=COMPLETED&demographic=SHOUNEN&page=2');

    const params = request.request.params;
    expect(params.get('q')).toBe('solo');
    expect(params.getAll('genre')).toEqual(['Action', 'Fantasy']);
    expect(params.getAll('excludeGenre')).toEqual(['Romance']);
    expect(params.get('type')).toBe('MANHWA');
    expect(params.get('status')).toBe('COMPLETED');
    expect(params.get('demographic')).toBe('SHOUNEN');
    expect(params.get('page')).toBe('2');
    expect(el().textContent).toContain('Results for “solo”');
    expect(el().textContent).toContain('Chugong');
  });

  it('ignores unknown facet values in the URL instead of sending them', async () => {
    const request = await open('/works?type=NOVEL&page=-4');

    expect(request.request.params.has('type')).toBe(false);
    expect(request.request.params.get('page')).toBe('0');
  });

  it('a facet change goes back to the first page and is kept in the URL', async () => {
    await open('/works?page=3');

    const select = el().querySelectorAll<HTMLSelectElement>('select')[0];
    select.value = 'MANGA';
    select.dispatchEvent(new Event('change'));
    const request = await nextWorksRequest();

    expect(request.request.params.get('type')).toBe('MANGA');
    expect(request.request.params.get('page')).toBe('0');
    expect(TestBed.inject(Router).url).toBe('/works?type=MANGA');
  });

  it('says when no series match and clears every filter', async () => {
    await open('/works?genre=Romance&type=COMIC', []);

    expect(el().textContent).toContain('No series match these filters.');
    el().querySelector<HTMLButtonElement>('.clear-filters')!.click();
    await nextWorksRequest();

    expect(TestBed.inject(Router).url).toBe('/works');
  });

  it('shows an error with a retry when the search fails', async () => {
    await harness.navigateByUrl('/works');
    await settle();
    http.expectOne(`${API}/works/genres`).flush({ success: true, data: [], error: null });
    worksRequest().flush({ success: false, data: null, error: 'down' });
    await settle();

    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Could not load the catalog.');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await nextWorksRequest();
    expect(el().textContent).toContain('Solo Leveling');
  });

  it('"Surprise me" opens a random series matching the filters, or says none match', async () => {
    await open('/works?genre=Romance');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    el().querySelector<HTMLButtonElement>('button.surprise')!.click();
    const req = http.expectOne((r) => r.url === `${API}/works/random`);
    expect(req.request.params.getAll('genre')).toEqual(['Romance']);
    expect(req.request.params.has('page')).toBe(false);
    req.flush({ success: true, data: SOLO, error: null });
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/works', 'w-1']);

    el().querySelector<HTMLButtonElement>('button.surprise')!.click();
    http.expectOne((r) => r.url === `${API}/works/random`).flush({ success: false, data: null, error: 'none' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(el().querySelector('.surprise-message')!.textContent).toContain('No series match these filters.');
  });
});
