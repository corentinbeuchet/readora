import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RankingsPage } from '@app/features/discovery/rankings-page';
import { RankedWork } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';

const API = environment.apiUrl;

function ranked(rank: number, title: string, score: number, ratings = 0): RankedWork {
  return { rank, work: { id: `w-${rank}`, title, type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: [] }, score, ratings };
}

describe('RankingsPage (US-08)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'rankings', component: RankingsPage }], withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
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

  function answerBoth(popular: RankedWork[], period: string, top: RankedWork[] = []): void {
    const req = http.expectOne((r) => r.url === `${API}/rankings/popular`);
    expect(req.request.params.get('period')).toBe(period);
    req.flush({ success: true, data: popular, error: null });
    http.expectOne(`${API}/rankings/top-rated`).flush({ success: true, data: top, error: null });
  }

  it('shows this week\'s popular series by default and switches period from the URL', async () => {
    await harness.navigateByUrl('/rankings');
    await settle();
    answerBoth([ranked(1, 'Horimiya', 18), ranked(2, 'One Piece', 5)], 'WEEK');
    await settle();

    expect(el().querySelector('.ranking-entry')!.textContent).toContain('#1');
    expect(el().querySelector('.ranking-entry')!.textContent).toContain('Horimiya');
    expect(el().querySelector('.period-tabs [aria-current="page"]')!.textContent!.trim()).toBe('This week');

    await harness.navigateByUrl('/rankings?period=ALL');
    await settle();
    http.expectOne((r) => r.url === `${API}/rankings/popular` && r.params.get('period') === 'ALL').flush({ success: true, data: [], error: null });
    await settle();
    expect(el().textContent).toContain('Not enough activity yet');
  });

  it('shows top rated with averages and rating counts', async () => {
    await harness.navigateByUrl('/rankings?list=top-rated');
    await settle();
    answerBoth([], 'WEEK', [ranked(1, 'One Piece', 9.1, 40)]);
    await settle();

    expect(el().querySelector('.ranking-entry')!.textContent).toContain('★ 9.1 · 40 ratings');
  });
});
