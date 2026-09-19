import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { WorksPage } from '@app/features/catalog/works-page/works-page';
import { PagedResponse } from '@app/core/models/api';
import { WorkSummary } from '@app/core/models/catalog';
import { API, BlankPage, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

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

/** A string is a single value, an array every value of a repeated param, `null` an absent param. */
type Params = Record<string, string | string[] | null>;

describe('WorksPage (US-04 catalog filters)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'works', component: WorksPage },
            { path: 'works/:workId', component: BlankPage }
          ],
          withComponentInputBinding()
        ),
        ...provideHttpTesting()
      ]
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  it('Clicking a genre cycles between wanted, excluded and ignored', async () => {
    await givenIAmOn('/works');

    await whenIClickTheGenre('Action');

    thenTheGenreIs('Action', 'wanted');
    thenTheCatalogWasAskedFor({ genre: ['Action'], excludeGenre: null });

    await whenIClickTheGenre('Action');

    thenTheGenreIs('Action', 'excluded');
    thenTheCatalogWasAskedFor({ genre: null, excludeGenre: ['Action'] });

    await whenIClickTheGenre('Action');

    thenTheGenreIs('Action', 'not filtered');
    thenTheCatalogWasAskedFor({ genre: null, excludeGenre: null });
  });

  it('reads every filter from the URL and sends it to the API', async () => {
    await whenIOpen('/works?q=solo&genre=Action&genre=Fantasy&excludeGenre=Romance&type=MANHWA&status=COMPLETED&demographic=SHOUNEN&page=2');

    thenTheCatalogWasAskedFor({
      q: 'solo',
      genre: ['Action', 'Fantasy'],
      excludeGenre: ['Romance'],
      type: 'MANHWA',
      status: 'COMPLETED',
      demographic: 'SHOUNEN',
      page: '2'
    });
    thenICanSee('Results for “solo”');
    thenICanSee('Chugong');
  });

  it('ignores unknown facet values in the URL instead of sending them', async () => {
    await whenIOpen('/works?type=NOVEL&page=-4');

    thenTheCatalogWasAskedFor({ type: null, page: '0' });
  });

  it('a facet change goes back to the first page and is kept in the URL', async () => {
    await givenIAmOn('/works?page=3');

    await whenIChooseTheType('MANGA');

    thenTheCatalogWasAskedFor({ type: 'MANGA', page: '0' });
    thenTheUrlIs('/works?type=MANGA');
  });

  it('says when no series match and clears every filter', async () => {
    await givenIAmOn('/works?genre=Romance&type=COMIC', { results: [] });
    thenICanSee('No series match these filters.');

    await whenIClearEveryFilter();

    thenTheUrlIs('/works');
  });

  it('shows an error with a retry when the search fails', async () => {
    await givenTheSearchFailsWhenIOpen('/works');
    thenTheErrorSays('Could not load the catalog.');

    await whenIRetry({ results: [SOLO] });

    thenICanSee('Solo Leveling');
  });

  it('"Surprise me" opens a random series matching the filters, or says none match', async () => {
    await givenIAmOn('/works?genre=Romance');

    await whenIAskForASurprise({ pick: null });

    thenTheSurpriseSays('No series match these filters.');

    await whenIAskForASurprise({ pick: SOLO });

    thenTheRandomPickWasAskedFor({ genre: ['Romance'], page: null });
    thenTheUrlIs('/works/w-1');
  });

  async function givenIAmOn(url: string, catalog: { results?: WorkSummary[] } = {}): Promise<void> {
    await whenIOpen(url, catalog);
  }

  async function givenTheSearchFailsWhenIOpen(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await settle(harness);
    http.expectOne(`${API}/works/genres`).flush(ok([]));
    worksRequest().flush(fail('down'));
    await settle(harness);
  }

  async function whenIOpen(url: string, catalog: { results?: WorkSummary[] } = {}): Promise<void> {
    await harness.navigateByUrl(url);
    await settle(harness);
    http.expectOne(`${API}/works/genres`).flush(ok(['Action', 'Fantasy', 'Romance']));
    lastRequest = worksRequest();
    lastRequest.flush(ok(page(catalog.results ?? [SOLO])));
    await settle(harness);
  }

  async function whenIClickTheGenre(genre: string): Promise<void> {
    chip(genre).click();
    await answerTheNextSearch([SOLO]);
  }

  async function whenIChooseTheType(type: string): Promise<void> {
    const select = el().querySelectorAll<HTMLSelectElement>('select')[0];
    select.value = type;
    select.dispatchEvent(new Event('change'));
    await answerTheNextSearch([SOLO]);
  }

  async function whenIClearEveryFilter(): Promise<void> {
    el().querySelector<HTMLButtonElement>('.clear-filters')!.click();
    await answerTheNextSearch([SOLO]);
  }

  async function whenIRetry(catalog: { results: WorkSummary[] }): Promise<void> {
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await answerTheNextSearch(catalog.results);
  }

  /** `pick: null` is answered like the API does when nothing matches: a 404. */
  async function whenIAskForASurprise(answer: { pick: WorkSummary | null }): Promise<void> {
    el().querySelector<HTMLButtonElement>('button.surprise')!.click();
    lastRequest = http.expectOne((r) => r.url === `${API}/works/random`);
    if (answer.pick) {
      lastRequest.flush(ok(answer.pick));
    } else {
      lastRequest.flush(fail('none'), { status: 404, statusText: 'Not Found' });
    }
    await settle(harness);
  }

  function thenTheGenreIs(genre: string, state: string): void {
    expect(chip(genre).getAttribute('aria-label')).toBe(`${genre}: ${state}`);
  }

  function thenTheCatalogWasAskedFor(params: Params): void {
    expectLastRequestParams(params);
  }

  function thenTheRandomPickWasAskedFor(params: Params): void {
    expectLastRequestParams(params);
  }

  function thenICanSee(text: string): void {
    expect(el().textContent).toContain(text);
  }

  function thenTheUrlIs(url: string): void {
    expect(TestBed.inject(Router).url).toBe(url);
  }

  function thenTheErrorSays(message: string): void {
    expect(el().querySelector('[role="alert"]')?.textContent).toContain(message);
  }

  function thenTheSurpriseSays(message: string): void {
    expect(el().querySelector('.surprise-message')!.textContent).toContain(message);
  }

  async function answerTheNextSearch(results: WorkSummary[]): Promise<void> {
    await settle(harness);
    lastRequest = worksRequest();
    lastRequest.flush(ok(page(results)));
    await settle(harness);
  }

  function expectLastRequestParams(params: Params): void {
    const sent = lastRequest.request.params;
    for (const [name, value] of Object.entries(params)) {
      if (value === null) expect(sent.has(name), name).toBe(false);
      else if (Array.isArray(value)) expect(sent.getAll(name), name).toEqual(value);
      else expect(sent.get(name), name).toBe(value);
    }
  }

  function worksRequest(): TestRequest {
    return http.expectOne((r) => r.url === `${API}/works`);
  }

  function el(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function chip(genre: string): HTMLButtonElement {
    return Array.from(el().querySelectorAll<HTMLButtonElement>('.chip')).find((b) => b.textContent?.includes(genre))!;
  }
});
