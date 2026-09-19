import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RankingsPage } from '@app/features/discovery/rankings-page/rankings-page';
import { RankedWork } from '@app/core/models/discovery';
import { API, ok, provideHttpTesting, settle } from '../../../test-utils';

function ranked(rank: number, title: string, score: number, ratings = 0): RankedWork {
  return { rank, work: { id: `w-${rank}`, title, type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: [] }, score, ratings };
}

describe('RankingsPage (US-08)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'rankings', component: RankingsPage }], withComponentInputBinding()), ...provideHttpTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  it('shows this week\'s popular series by default and switches period from the URL', async () => {
    await whenIOpen('/rankings', { popular: [ranked(1, 'Horimiya', 18), ranked(2, 'One Piece', 5)] });

    thenThePopularRankingWasAskedFor('WEEK');
    thenTheFirstEntryShows('#1');
    thenTheFirstEntryShows('Horimiya');
    thenTheSelectedPeriodIs('This week');

    await whenIOpen('/rankings?period=ALL', { popular: [] });

    thenThePopularRankingWasAskedFor('ALL');
    thenICanSee('Not enough activity yet');
  });

  it('shows top rated with averages and rating counts', async () => {
    await whenIOpen('/rankings?list=top-rated', { topRated: [ranked(1, 'One Piece', 9.1, 40)] });

    thenTheFirstEntryShows('★ 9.1 · 40 ratings');
  });

  /** Only the visible ranking is fetched: `http.verify()` fails on a request for the other one. */
  async function whenIOpen(url: string, answer: { popular: RankedWork[] } | { topRated: RankedWork[] }): Promise<void> {
    await harness.navigateByUrl(url);
    await settle(harness);
    if ('popular' in answer) {
      lastRequest = http.expectOne((r) => r.url === `${API}/rankings/popular`);
      lastRequest.flush(ok(answer.popular));
    } else {
      lastRequest = http.expectOne(`${API}/rankings/top-rated`);
      lastRequest.flush(ok(answer.topRated));
    }
    await settle(harness);
  }

  function thenThePopularRankingWasAskedFor(period: string): void {
    expect(lastRequest.request.params.get('period')).toBe(period);
  }

  function thenTheFirstEntryShows(text: string): void {
    expect(el().querySelector('.ranking-entry')!.textContent).toContain(text);
  }

  function thenTheSelectedPeriodIs(label: string): void {
    expect(el().querySelector('.period-tabs [aria-current="page"]')!.textContent!.trim()).toBe(label);
  }

  function thenICanSee(text: string): void {
    expect(el().textContent).toContain(text);
  }

  function el(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }
});
