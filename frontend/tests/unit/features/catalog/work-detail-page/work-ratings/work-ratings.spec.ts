import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { WorkRatings } from '@app/features/catalog/work-detail-page/work-ratings/work-ratings';
import { AuthStore } from '@app/core/auth/auth-store';
import { WorkReview } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../../../test-utils';

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

interface RatingSummary {
  average: number;
  count: number;
}

describe('WorkRatings (US-09)', () => {
  let fixture: ComponentFixture<WorkRatings>;
  let http: HttpTestingController;
  let myRating: number | null;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkRatings],
      providers: [...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows the average and the reviews to everyone, without rating controls for guests', async () => {
    await givenIOpenTheRatings({ average: 8, count: 2 }, [REVIEW]);

    thenICanSee('8.0');
    thenICanSee('from 2 ratings');
    thenICanSee('Worth it');
    thenICannotRate();
  });

  it('rates the series and refreshes the average', async () => {
    await givenIAmSignedIn({ myRating: null });
    await givenIOpenTheRatings();

    await whenIRate(9, { newSummary: { average: 8.3, count: 3 } });

    thenTheRatingRequestWas('PUT', { score: 9 });
    thenTheSelectedScoreIs('9');
    thenICanSee('8.3');
  });

  it('asks to rate before reviewing, then publishes a review', async () => {
    await givenIAmSignedIn({ myRating: null });
    await givenIOpenTheRatings();

    await whenITryToPublishAReview('A masterpiece');

    thenTheAlertSays('Rate the series before writing a review.');
  });

  it('publishes a review for a reader who already rated', async () => {
    await givenIAmSignedIn({ myRating: 9 });
    await givenIOpenTheRatings();

    await whenIPublishAReview('A masterpiece');

    thenTheReviewSentWas({ score: 9, verdict: 'A masterpiece' });
    thenTheReviewFormIsClosed();
  });

  it('keeps what I am typing in my review when I change my rating', async () => {
    await givenIAmSignedIn({ myRating: 7 });
    await givenIOpenTheRatings();
    await givenIAmWritingAReview('Half-written thoughts');

    await whenIRate(9, { newSummary: { average: 9, count: 1 } });

    thenMyReviewDraftIs('Half-written thoughts');
    thenTheCheckedScoreIs('9');
  });

  it('offers a retry when the ratings cannot be loaded', async () => {
    await givenTheRatingsFailWhenIOpenThem();
    thenTheAlertSays('Could not load the ratings.');

    await whenIRetry({ average: 8, count: 2 });

    thenThereIsNoAlert();
  });

  it("votes someone else's review helpful", async () => {
    await givenIAmSignedIn({ myRating: 9 });
    await givenIOpenTheRatings();

    await whenIVoteTheReviewHelpful({ votesNow: 3 });

    thenTheReviewFooterSays('3 found this helpful');
  });

  /** `myRating: null` is answered with the API's 404: I have not rated the series. */
  async function givenIAmSignedIn(state: { myRating: number | null }): Promise<void> {
    myRating = state.myRating;
    await signIn(TestBed.inject(AuthStore), http, mockUser({ id: 'kenji-id', permissions: ['RATE_WORK'] }));
  }

  async function givenIOpenTheRatings(summary: RatingSummary = { average: 8, count: 2 }, reviews: WorkReview[] = [REVIEW]): Promise<void> {
    await createTheRatings();
    http.expectOne(`${API}/works/w-1/ratings`).flush(ok(summary));
    http.expectOne(`${API}/works/w-1/reviews`).flush(ok(reviews));
    if (TestBed.inject(AuthStore).isAuthenticated()) {
      const mine = http.expectOne(`${API}/works/w-1/rating/mine`);
      if (myRating === null) {
        mine.flush(fail('Not found'), { status: 404, statusText: 'Not Found' });
      } else {
        mine.flush(ok({ id: 'mine', workId: 'w-1', score: myRating }));
      }
    }
    await settle(fixture);
  }

  async function givenIAmWritingAReview(text: string): Promise<void> {
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('review'))!.click();
    await settle(fixture);
    typeTheVerdict(text);
    await settle(fixture);
  }

  async function givenTheRatingsFailWhenIOpenThem(): Promise<void> {
    await createTheRatings();
    http.expectOne(`${API}/works/w-1/ratings`).flush(fail('down'), { status: 503, statusText: 'Unavailable' });
    http.expectOne(`${API}/works/w-1/reviews`).flush(ok([]));
    await settle(fixture);
  }

  async function whenIRate(score: number, answer: { newSummary: RatingSummary }): Promise<void> {
    (fixture.nativeElement.querySelector(`input[name="my-rating"][value="${score}"]`) as HTMLInputElement).click();
    lastRequest = http.expectOne(`${API}/works/w-1/rating`);
    lastRequest.flush(ok({ id: 'mine', workId: 'w-1', score }));
    await settle(fixture);
    http.expectOne(`${API}/works/w-1/ratings`).flush(ok(answer.newSummary));
    await settle(fixture);
  }

  async function whenITryToPublishAReview(verdict: string): Promise<void> {
    await submitAReview(verdict);
  }

  async function whenIPublishAReview(verdict: string): Promise<void> {
    await submitAReview(verdict);
    lastRequest = http.expectOne(`${API}/works/w-1/review`);
    lastRequest.flush(ok({ id: 'mine', workId: 'w-1', score: myRating, verdict }));
    await settle(fixture);
    http.expectOne(`${API}/works/w-1/reviews`).flush(ok([REVIEW]));
    await settle(fixture);
  }

  async function whenIRetry(summary: RatingSummary): Promise<void> {
    alertBox()!.querySelector('button')!.click();
    await settle(fixture);
    http.expectOne(`${API}/works/w-1/ratings`).flush(ok(summary));
    await settle(fixture);
  }

  async function whenIVoteTheReviewHelpful(answer: { votesNow: number }): Promise<void> {
    fixture.nativeElement.querySelector('.review-footer button').click();
    http.expectOne(`${API}/reviews/r-1/helpful`).flush(ok({ helpfulVotes: answer.votesNow }));
    await settle(fixture);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenICannotRate(): void {
    expect(fixture.nativeElement.querySelector('.my-rating')).toBeNull();
  }

  function thenTheRatingRequestWas(method: string, body: { score: number }): void {
    expect(lastRequest.request.method).toBe(method);
    expect(lastRequest.request.body).toEqual(body);
  }

  function thenTheSelectedScoreIs(score: string): void {
    expect(fixture.nativeElement.querySelector('.score-option.selected').textContent.trim()).toBe(score);
  }

  function thenTheCheckedScoreIs(score: string): void {
    expect((fixture.nativeElement.querySelector(`input[type="radio"][value="${score}"]`) as HTMLInputElement).checked).toBe(true);
  }

  function thenTheAlertSays(message: string): void {
    expect(alertBox()!.textContent).toContain(message);
  }

  function thenThereIsNoAlert(): void {
    expect(alertBox()).toBeNull();
  }

  function thenTheReviewSentWas(body: { score: number; verdict: string }): void {
    expect(lastRequest.request.body).toEqual(body);
  }

  function thenTheReviewFormIsClosed(): void {
    expect(fixture.nativeElement.querySelector('form.review-form')).toBeNull();
  }

  function thenMyReviewDraftIs(text: string): void {
    expect((fixture.nativeElement.querySelector('#review-verdict') as HTMLTextAreaElement).value).toBe(text);
  }

  function thenTheReviewFooterSays(text: string): void {
    expect(fixture.nativeElement.querySelector('.review-footer').textContent).toContain(text);
  }

  async function createTheRatings(): Promise<void> {
    fixture = TestBed.createComponent(WorkRatings);
    fixture.componentRef.setInput('workId', 'w-1');
    await settle(fixture);
  }

  async function submitAReview(verdict: string): Promise<void> {
    fixture.nativeElement.querySelector('.ratings > .btn').click();
    await settle(fixture);
    typeTheVerdict(verdict);
    fixture.nativeElement.querySelector('form.review-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  function typeTheVerdict(text: string): void {
    const verdict: HTMLTextAreaElement = fixture.nativeElement.querySelector('#review-verdict');
    verdict.value = text;
    verdict.dispatchEvent(new Event('input'));
  }

  function alertBox(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="alert"]');
  }
});
