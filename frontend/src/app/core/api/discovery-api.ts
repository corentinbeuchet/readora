import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CatalogQuery, WorkSummary } from '@app/core/models/catalog';
import { RankedWork, RankingPeriod, Release } from '@app/core/models/discovery';
import { ApiClient, nullIfNotFound, parseEnvelope } from './api-client';
import { catalogParams } from './catalog-api';

/** Latest updates, rankings and random picks (US-08). All public; "mine" needs a signed-in reader. */
@Service()
export class DiscoveryApi {
  private readonly api = inject(ApiClient);

  /** Latest chapters, of every series or of the reader's library (`mine`); idle while `enabled` is given and false. */
  latestResource(mine: Signal<boolean>, page: Signal<number>, enabled?: Signal<boolean>): HttpResourceRef<Release[]> {
    return httpResource<Release[]>(
      () => (enabled?.() === false ? undefined : { url: this.api.url('/updates'), params: { mine: mine(), page: page() } }),
      { parse: (raw) => parseEnvelope<Release[]>(raw) ?? [], defaultValue: [] }
    );
  }

  /** Popular series for a period; idle while `enabled` is false (another ranking is shown). */
  popularResource(period: Signal<RankingPeriod>, enabled: Signal<boolean>): HttpResourceRef<RankedWork[]> {
    return httpResource<RankedWork[]>(
      () => (enabled() ? { url: this.api.url('/rankings/popular'), params: { period: period() } } : undefined),
      { parse: (raw) => parseEnvelope<RankedWork[]>(raw) ?? [], defaultValue: [] }
    );
  }

  /** Best rated series; idle while `enabled` is false (another ranking is shown). */
  topRatedResource(enabled: Signal<boolean>): HttpResourceRef<RankedWork[]> {
    return httpResource<RankedWork[]>(() => (enabled() ? this.api.url('/rankings/top-rated') : undefined), {
      parse: (raw) => parseEnvelope<RankedWork[]>(raw) ?? [],
      defaultValue: []
    });
  }

  /** A random series matching the filters, or `null` when nothing matches. */
  random(query: Omit<CatalogQuery, 'page' | 'size' | 'text'>): Observable<WorkSummary | null> {
    const params = catalogParams({ ...query, page: 0, size: 1 });
    delete params['page'];
    delete params['size'];
    return this.api.get<WorkSummary>('/works/random', { params }).pipe(nullIfNotFound());
  }
}
