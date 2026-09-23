import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { PublicProfile, ReaderRef, TeamProfile } from '@app/core/models/community';
import { ApiClient, parseEnvelope, toApiError } from './api-client';

/** Public profiles, team pages, team follows and the library export (US-12). */
@Service()
export class CommunityApi {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);

  profileResource(username: Signal<string | undefined>): HttpResourceRef<PublicProfile | undefined> {
    return httpResource<PublicProfile | undefined>(
      () => {
        const name = username();
        return name ? this.api.url(`/users/${encodeURIComponent(name)}/profile`) : undefined;
      },
      { parse: (raw) => parseEnvelope<PublicProfile>(raw) }
    );
  }

  teamResource(teamId: Signal<string | undefined>): HttpResourceRef<TeamProfile | undefined> {
    return httpResource<TeamProfile | undefined>(
      () => {
        const id = teamId();
        return id ? this.api.url(`/teams/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<TeamProfile>(raw) }
    );
  }

  /** Readers whose username starts with `text` (at least 2 characters), to invite them to a team. */
  findReaders(text: string): Observable<ReaderRef[]> {
    return this.api.get<ReaderRef[]>('/users', { params: { q: text } });
  }

  follow(teamId: string): Observable<unknown> {
    return this.api.put(`/teams/${teamId}/follow`, {});
  }

  unfollow(teamId: string): Observable<unknown> {
    return this.api.delete(`/teams/${teamId}/follow`);
  }

  /** The export is a file, not an API envelope; failures still surface as `ApiError`. */
  exportLibrary(format: 'csv' | 'json'): Observable<Blob> {
    return this.http.get(this.api.url('/library/export'), { params: { format }, responseType: 'blob' }).pipe(catchError(toApiError));
  }
}
