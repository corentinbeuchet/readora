import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Omnisearch, SUGGEST_DEBOUNCE_MS } from '@app/features/layout/components/omnisearch';
import { WorkSummary } from '@app/core/models/readora.models';
import { environment } from '../../../../../src/environments/environment';

const API = environment.apiUrl;

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

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [Omnisearch],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Omnisearch);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const input = (): HTMLInputElement => fixture.nativeElement.querySelector('input[role="combobox"]');
  const options = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));

  async function type(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(SUGGEST_DEBOUNCE_MS);
    fixture.detectChanges();
  }

  function answer(items: WorkSummary[], text: string): void {
    const request = http.expectOne((r) => r.url === `${API}/works`);
    expect(request.request.params.get('q')).toBe(text);
    expect(request.request.params.get('size')).toBe('5');
    request.flush({ success: true, data: { items, page: 0, size: 5, totalElements: items.length, totalPages: 1 }, error: null });
    fixture.detectChanges();
  }

  function press(key: string): void {
    input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  it('suggests matches with their author after a short pause, not on every keystroke', async () => {
    input().value = 'o';
    input().dispatchEvent(new Event('input'));
    input().value = 'om';
    input().dispatchEvent(new Event('input'));
    await type('omni');

    answer([OMNI], 'omni');

    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(options()).toHaveLength(1);
    expect(options()[0].textContent).toContain('Omniscient Reader');
    expect(options()[0].textContent).toContain('Sing Shong');
  });

  it('does not search for a single character', async () => {
    await type('o');

    http.expectNone((r) => r.url === `${API}/works`);
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('moves through suggestions with the arrow keys and opens the active one with Enter', async () => {
    await type('om');
    answer([OMNI, OMEGA], 'om');

    press('ArrowDown');
    press('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[1].id);
    expect(options()[1].getAttribute('aria-selected')).toBe('true');

    press('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);

    press('Enter');
    expect(router.navigate).toHaveBeenCalledWith(['/works', 'w-2']);
    expect(input().value).toBe('');
  });

  it('Enter without an active suggestion opens the full results page', async () => {
    await type('omni');
    answer([OMNI], 'omni');

    press('Enter');

    expect(router.navigate).toHaveBeenCalledWith(['/works'], { queryParams: { q: 'omni' } });
  });

  it('Escape closes the suggestions, a second Escape clears the text', async () => {
    await type('omni');
    answer([OMNI], 'omni');

    press('Escape');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().value).toBe('omni');

    press('Escape');
    expect(input().value).toBe('');
  });

  it('says when nothing matches and when search is unavailable', async () => {
    await type('zzz');
    answer([], 'zzz');
    expect(fixture.nativeElement.textContent).toContain('No series match “zzz”.');

    await type('zzzz');
    http.expectOne((r) => r.url === `${API}/works`).flush({ success: false, data: null, error: 'down' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Search is unavailable right now.');

    await type('omni');
    answer([OMNI], 'omni');
    expect(options()).toHaveLength(1);
  });
});
