import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { PublicProfile, TeamProfile } from '@app/core/models/readora.models';
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

  teamResource(projectId: Signal<string | undefined>): HttpResourceRef<TeamProfile | undefined> {
    return httpResource<TeamProfile | undefined>(
      () => {
        const id = projectId();
        return id ? this.api.url(`/teams/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<TeamProfile>(raw) }
    );
  }

  follow(projectId: string): Observable<unknown> {
    return this.api.put(`/teams/${projectId}/follow`, {});
  }

  unfollow(projectId: string): Observable<unknown> {
    return this.api.delete(`/teams/${projectId}/follow`);
  }

  /** The export is a file, not an API envelope; failures still surface as `ApiError`. */
  exportLibrary(format: 'csv' | 'json'): Observable<Blob> {
    return this.http.get(this.api.url('/library/export'), { params: { format }, responseType: 'blob' }).pipe(catchError(toApiError));
  }
}
