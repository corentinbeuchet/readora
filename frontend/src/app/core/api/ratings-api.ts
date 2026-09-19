import { httpResource, HttpResourceRef } from '@angular/common/http';
import { ResourceRef, Service, Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, map } from 'rxjs';
import { MyRating, RatingSummary, ReviewPayload, WorkReview } from '@app/core/models/reviews';
import { ApiClient, nullIfNotFound, parseEnvelope } from './api-client';

const NO_RATINGS: RatingSummary = { average: 0, count: 0 };

/** Ratings and reviews of series (US-09). Reads are public; writes need `RATE_WORK`. */
@Service()
export class RatingsApi {
  private readonly api = inject(ApiClient);

  rate(workId: string, score: number): Observable<MyRating> {
    return this.api.put<MyRating>(`/works/${workId}/rating`, { score });
  }

  review(workId: string, payload: ReviewPayload): Observable<MyRating> {
    return this.api.put<MyRating>(`/works/${workId}/review`, payload);
  }

  markHelpful(reviewId: string): Observable<number> {
    return this.api.post<{ helpfulVotes: number }>(`/reviews/${reviewId}/helpful`).pipe(map((r) => r.helpfulVotes));
  }

  /** My rating of the series, or `null` if I haven't rated it (404). */
  mine(workId: string): Observable<MyRating | null> {
    return this.api.get<MyRating>(`/works/${workId}/rating/mine`).pipe(nullIfNotFound());
  }

  /** My rating of the series (`null` when not rated yet); idle while `enabled` is false. */
  mineResource(workId: Signal<string | undefined>, enabled: Signal<boolean>): ResourceRef<MyRating | null | undefined> {
    return rxResource({
      params: () => {
        const id = workId();
        return id && enabled() ? id : undefined;
      },
      stream: ({ params }) => this.mine(params)
    });
  }

  summaryResource(workId: Signal<string | undefined>): HttpResourceRef<RatingSummary> {
    return httpResource<RatingSummary>(
      () => {
        const id = workId();
        return id ? this.api.url(`/works/${id}/ratings`) : undefined;
      },
      { parse: (raw) => parseEnvelope<RatingSummary>(raw) ?? NO_RATINGS, defaultValue: NO_RATINGS }
    );
  }

  reviewsResource(workId: Signal<string | undefined>): HttpResourceRef<WorkReview[]> {
    return httpResource<WorkReview[]>(
      () => {
        const id = workId();
        return id ? this.api.url(`/works/${id}/reviews`) : undefined;
      },
      { parse: (raw) => parseEnvelope<WorkReview[]>(raw) ?? [], defaultValue: [] }
    );
  }
}
