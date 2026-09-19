import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RankingsPage } from '@app/features/discovery/rankings-page';
import { RankedWork } from '@app/core/models/readora.models';
import { API, ok, provideHttpTesting, settle } from '../../test-utils';

function ranked(rank: number, title: string, score: number, ratings = 0): RankedWork {
  return { rank, work: { id: `w-${rank}`, title, type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: [] }, score, ratings };
}

describe('RankingsPage (US-08)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'rankings', component: RankingsPage }], withComponentInputBinding()), ...provideHttpTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  function answerPopular(popular: RankedWork[], period: string): void {
    const req = http.expectOne((r) => r.url === `${API}/rankings/popular`);
    expect(req.request.params.get('period')).toBe(period);
    req.flush(ok(popular));
  }

  it('shows this week\'s popular series by default and switches period from the URL', async () => {
    await harness.navigateByUrl('/rankings');
    await settle(harness);
    // Only the visible ranking is fetched (http.verify() fails on a top-rated request).
    answerPopular([ranked(1, 'Horimiya', 18), ranked(2, 'One Piece', 5)], 'WEEK');
    await settle(harness);

    expect(el().querySelector('.ranking-entry')!.textContent).toContain('#1');
    expect(el().querySelector('.ranking-entry')!.textContent).toContain('Horimiya');
    expect(el().querySelector('.period-tabs [aria-current="page"]')!.textContent!.trim()).toBe('This week');

    await harness.navigateByUrl('/rankings?period=ALL');
    await settle(harness);
    http.expectOne((r) => r.url === `${API}/rankings/popular` && r.params.get('period') === 'ALL').flush(ok([]));
    await settle(harness);
    expect(el().textContent).toContain('Not enough activity yet');
  });

  it('shows top rated with averages and rating counts', async () => {
    await harness.navigateByUrl('/rankings?list=top-rated');
    await settle(harness);
    http.expectOne(`${API}/rankings/top-rated`).flush(ok([ranked(1, 'One Piece', 9.1, 40)]));
    await settle(harness);

    expect(el().querySelector('.ranking-entry')!.textContent).toContain('★ 9.1 · 40 ratings');
  });
});
