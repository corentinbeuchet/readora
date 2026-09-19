import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { CatalogQuery, RankedWork, RankingPeriod, Release, WorkSummary } from '../models/readora.models';
import { ApiClient, ApiError, parseEnvelope } from './api-client';
import { catalogParams } from './catalog-api';

/** Latest updates, rankings and random picks (US-08). All public; "mine" needs a signed-in reader. */
@Service()
export class DiscoveryApi {
  private readonly api = inject(ApiClient);

  latestResource(mine: Signal<boolean>, page: Signal<number>): HttpResourceRef<Release[]> {
    return httpResource<Release[]>(
      () => ({ url: this.api.url('/updates'), params: { mine: mine(), page: page() } }),
      { parse: (raw) => parseEnvelope<Release[]>(raw) ?? [], defaultValue: [] }
    );
  }

  popularResource(period: Signal<RankingPeriod>): HttpResourceRef<RankedWork[]> {
    return httpResource<RankedWork[]>(
      () => ({ url: this.api.url('/rankings/popular'), params: { period: period() } }),
      { parse: (raw) => parseEnvelope<RankedWork[]>(raw) ?? [], defaultValue: [] }
    );
  }

  topRatedResource(): HttpResourceRef<RankedWork[]> {
    return httpResource<RankedWork[]>(() => this.api.url('/rankings/top-rated'), {
      parse: (raw) => parseEnvelope<RankedWork[]>(raw) ?? [],
      defaultValue: []
    });
  }

  /** A random series matching the filters, or `null` when nothing matches. */
  random(query: Omit<CatalogQuery, 'page' | 'size' | 'text'>): Observable<WorkSummary | null> {
    const params = catalogParams({ ...query, page: 0, size: 1 });
    delete params['page'];
    delete params['size'];
    return this.api.get<WorkSummary>('/works/random', { params }).pipe(
      catchError((error: unknown) => (error instanceof ApiError && error.isNotFound ? of(null) : throwError(() => error)))
    );
  }
}
