import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Omnisearch, SUGGEST_DEBOUNCE_MS } from '@app/features/layout/shell/omnisearch/omnisearch';
import { WorkSummary } from '@app/core/models/readora.models';
import { ANY_URL, API, fail, ok, provideHttpTesting } from '../../../../test-utils';

const OMNI: WorkSummary = {
  id: 'w-2',
  title: 'Omniscient Reader',
  type: 'MANHWA',
  status: 'ONGOING',
  author: 'Sing Shong',
  coverImageUrl: '',
  genres: ['Action']
};
const OMEGA: WorkSummary = { ...OMNI, id: 'w-3', title: 'Omega Tower', author: null };

describe('Omnisearch (US-04 instant search)', () => {
  let fixture: ComponentFixture<Omnisearch>;
  let http: HttpTestingController;
  let router: Router;
  let searchRequest: TestRequest;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [Omnisearch],
      providers: [provideRouter(ANY_URL), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Omnisearch);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('suggests matches with their author after a short pause, not on every keystroke', async () => {
    await whenITypeWithoutPausing(['o', 'om', 'omni'], [OMNI]);

    thenTheSearchAskedFor({ q: 'omni', size: 5 });
    thenTheSuggestionsAreOpen(true);
    thenThereAreSuggestions(1);
    thenSuggestionShows(1, 'Omniscient Reader');
    thenSuggestionShows(1, 'Sing Shong');
  });

  it('does not search for a single character', async () => {
    await whenIType('o');

    thenNothingWasSearched();
    thenTheSuggestionsAreOpen(false);
  });

  it('moves through suggestions with the arrow keys and opens the active one with Enter', async () => {
    await givenIHaveSearchedFor('om', [OMNI, OMEGA]);
    thenTheSearchAskedFor({ q: 'om', size: 5 });

    whenIPress('ArrowDown');
    whenIPress('ArrowDown');

    thenTheActiveSuggestionIs(2);
    thenSuggestionIsSelected(2);

    whenIPress('ArrowDown');

    thenTheActiveSuggestionIs(1);

    await whenIPressEnter();

    thenIAmOn('/works/w-2');
    thenTheSearchBoxContains('');
  });

  it('Enter without an active suggestion opens the full results page', async () => {
    await givenIHaveSearchedFor('omni', [OMNI]);
    thenTheSearchAskedFor({ q: 'omni', size: 5 });

    await whenIPressEnter();

    thenIAmOn('/works?q=omni');
  });

  it('Escape closes the suggestions, a second Escape clears the text', async () => {
    await givenIHaveSearchedFor('omni', [OMNI]);
    thenTheSearchAskedFor({ q: 'omni', size: 5 });

    whenIPress('Escape');

    thenTheSuggestionsAreOpen(false);
    thenTheSearchBoxContains('omni');

    whenIPress('Escape');

    thenTheSearchBoxContains('');
  });

  it('says when nothing matches and when search is unavailable', async () => {
    await whenISearchFor('zzz', []);

    thenTheSearchAskedFor({ q: 'zzz', size: 5 });
    thenICanSee('No series match “zzz”.');

    await whenISearchForButSearchIsDown('zzzz');

    thenICanSee('Search is unavailable right now.');

    await whenISearchFor('omni', [OMNI]);

    thenTheSearchAskedFor({ q: 'omni', size: 5 });
    thenThereAreSuggestions(1);
  });

  async function givenIHaveSearchedFor(text: string, results: WorkSummary[]): Promise<void> {
    await search(text, results);
  }

  async function whenIType(text: string): Promise<void> {
    await typeAndPause(text);
  }

  /** Every keystroke but the last comes before the debounce ends; only the last text is searched. */
  async function whenITypeWithoutPausing(keystrokes: string[], results: WorkSummary[]): Promise<void> {
    for (const text of keystrokes.slice(0, -1)) {
      input().value = text;
      input().dispatchEvent(new Event('input'));
    }
    await search(keystrokes[keystrokes.length - 1], results);
  }

  async function whenISearchFor(text: string, results: WorkSummary[]): Promise<void> {
    await search(text, results);
  }

  async function whenISearchForButSearchIsDown(text: string): Promise<void> {
    await typeAndPause(text);
    http.expectOne((r) => r.url === `${API}/works`).flush(fail('down'));
    fixture.detectChanges();
  }

  function whenIPress(key: string): void {
    input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  async function whenIPressEnter(): Promise<void> {
    whenIPress('Enter');
    await vi.advanceTimersByTimeAsync(0);
  }

  function thenTheSearchAskedFor(params: { q: string; size: number }): void {
    expect(searchRequest.request.params.get('q')).toBe(params.q);
    expect(searchRequest.request.params.get('size')).toBe(String(params.size));
  }

  function thenNothingWasSearched(): void {
    http.expectNone((r) => r.url === `${API}/works`);
  }

  function thenTheSuggestionsAreOpen(open: boolean): void {
    expect(input().getAttribute('aria-expanded')).toBe(String(open));
  }

  function thenThereAreSuggestions(count: number): void {
    expect(options()).toHaveLength(count);
  }

  function thenSuggestionShows(position: number, text: string): void {
    expect(options()[position - 1].textContent).toContain(text);
  }

  function thenTheActiveSuggestionIs(position: number): void {
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[position - 1].id);
  }

  function thenSuggestionIsSelected(position: number): void {
    expect(options()[position - 1].getAttribute('aria-selected')).toBe('true');
  }

  function thenIAmOn(url: string): void {
    expect(router.url).toBe(url);
  }

  function thenTheSearchBoxContains(text: string): void {
    expect(input().value).toBe(text);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  async function search(text: string, results: WorkSummary[]): Promise<void> {
    await typeAndPause(text);
    searchRequest = http.expectOne((r) => r.url === `${API}/works`);
    searchRequest.flush(ok({ items: results, page: 0, size: 5, totalElements: results.length, totalPages: 1 }));
    fixture.detectChanges();
  }

  async function typeAndPause(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(SUGGEST_DEBOUNCE_MS);
    fixture.detectChanges();
  }

  function input(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[role="combobox"]');
  }

  function options(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }
});
