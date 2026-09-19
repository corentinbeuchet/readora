import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WorkRatings } from '@app/features/catalog/components/work-ratings';
import { AuthStore } from '@app/core/auth/auth-store';
import { WorkReview } from '@app/core/models/readora.models';
import { environment } from '../../../../../src/environments/environment';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { settle } from '../../../test-utils';

const API = environment.apiUrl;
const REVIEW: WorkReview = {
  id: 'r-1',
  authorId: 'aoi-id',
  authorUsername: 'aoi',
  score: 7,
  liked: 'The art',
  disliked: null,
  verdict: 'Worth it',
  helpfulVotes: 2,
  updatedAt: '2026-09-10T10:00:00Z'
};

describe('WorkRatings (US-09)', () => {
  let fixture: ComponentFixture<WorkRatings>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkRatings],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(signedIn: boolean, mine: number | null = null): Promise<void> {
    if (signedIn) {
      await signIn(TestBed.inject(AuthStore), http, mockUser({ id: 'kenji-id', permissions: ['RATE_WORK'] }));
    }
    fixture = TestBed.createComponent(WorkRatings);
    fixture.componentRef.setInput('workId', 'w-1');
    await settle(fixture);
    http.expectOne(`${API}/works/w-1/ratings`).flush({ success: true, data: { average: 8, count: 2 }, error: null });
    http.expectOne(`${API}/works/w-1/reviews`).flush({ success: true, data: [REVIEW], error: null });
    if (signedIn) {
      const req = http.expectOne(`${API}/works/w-1/rating/mine`);
      if (mine === null) {
        req.flush({ success: false, data: null, error: 'Not found' }, { status: 404, statusText: 'Not Found' });
      } else {
        req.flush({ success: true, data: { id: 'mine', workId: 'w-1', score: mine }, error: null });
      }
    }
    await settle(fixture);
  }

  const text = (): string => fixture.nativeElement.textContent;

  it('shows the average and the reviews to everyone, without rating controls for guests', async () => {
    await open(false);

    expect(text()).toContain('8.0');
    expect(text()).toContain('from 2 ratings');
    expect(text()).toContain('Worth it');
    expect(fixture.nativeElement.querySelector('.my-rating')).toBeNull();
  });

  it('rates the series and refreshes the average', async () => {
    await open(true);

    const nine: HTMLInputElement = fixture.nativeElement.querySelector('input[name="my-rating"][value="9"]');
    nine.click();
    const req = http.expectOne(`${API}/works/w-1/rating`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ score: 9 });
    req.flush({ success: true, data: { id: 'mine', workId: 'w-1', score: 9 }, error: null });
    await settle(fixture);
    http.expectOne(`${API}/works/w-1/ratings`).flush({ success: true, data: { average: 8.3, count: 3 }, error: null });
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('.score-option.selected').textContent.trim()).toBe('9');
    expect(text()).toContain('8.3');
  });

  it('asks to rate before reviewing, then publishes a review', async () => {
    await open(true);
    fixture.nativeElement.querySelector('.ratings > .btn').click();
    await settle(fixture);
    const verdict: HTMLTextAreaElement = fixture.nativeElement.querySelector('#review-verdict');
    verdict.value = 'A masterpiece';
    verdict.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form.review-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Rate the series before writing a review.');
  });

  it('publishes a review for a reader who already rated', async () => {
    await open(true, 9);
    fixture.nativeElement.querySelector('.ratings > .btn').click();
    await settle(fixture);
    const verdict: HTMLTextAreaElement = fixture.nativeElement.querySelector('#review-verdict');
    verdict.value = 'A masterpiece';
    verdict.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form.review-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);

    const req = http.expectOne(`${API}/works/w-1/review`);
    expect(req.request.body).toEqual({ score: 9, verdict: 'A masterpiece' });
    req.flush({ success: true, data: { id: 'mine', workId: 'w-1', score: 9, verdict: 'A masterpiece' }, error: null });
    await settle(fixture);
    http.expectOne(`${API}/works/w-1/reviews`).flush({ success: true, data: [REVIEW], error: null });
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('form.review-form')).toBeNull();
  });

  it('keeps what I am typing in my review when I change my rating', async () => {
    await open(true, 7);
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('review'))!.click();
    await settle(fixture);
    const verdict: HTMLTextAreaElement = fixture.nativeElement.querySelector('#review-verdict');
    verdict.value = 'Half-written thoughts';
    verdict.dispatchEvent(new Event('input'));
    await settle(fixture);

    (fixture.nativeElement.querySelector('input[type="radio"][value="9"]') as HTMLInputElement).click();
    http.expectOne(`${API}/works/w-1/rating`).flush({ success: true, data: { id: 'mine', workId: 'w-1', score: 9 }, error: null });
    await settle(fixture);
    http.match(`${API}/works/w-1/ratings`).forEach((r) => r.flush({ success: true, data: { average: 9, count: 1 }, error: null }));
    await settle(fixture);

    expect((fixture.nativeElement.querySelector('#review-verdict') as HTMLTextAreaElement).value).toBe('Half-written thoughts');
    expect((fixture.nativeElement.querySelector('input[type="radio"][value="9"]') as HTMLInputElement).checked).toBe(true);
  });

  it('offers a retry when the ratings cannot be loaded', async () => {
    fixture = TestBed.createComponent(WorkRatings);
    fixture.componentRef.setInput('workId', 'w-1');
    await settle(fixture);
    http.expectOne(`${API}/works/w-1/ratings`).flush({ success: false, data: null, error: 'down' }, { status: 503, statusText: 'Unavailable' });
    http.expectOne(`${API}/works/w-1/reviews`).flush({ success: true, data: [], error: null });
    await settle(fixture);
    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('Could not load the ratings.');
    alert.querySelector('button')!.click();
    await settle(fixture);
    http.expectOne(`${API}/works/w-1/ratings`).flush({ success: true, data: { average: 8, count: 2 }, error: null });
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it("votes someone else's review helpful", async () => {
    await open(true, 9);
    const helpful: HTMLButtonElement = fixture.nativeElement.querySelector('.review-footer button');
    helpful.click();
    http.expectOne(`${API}/reviews/r-1/helpful`).flush({ success: true, data: { helpfulVotes: 3 }, error: null });
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('.review-footer').textContent).toContain('3 found this helpful');
  });
});
