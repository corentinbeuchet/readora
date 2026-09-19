import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PublicProfile, TeamPage } from '../models/readora.models';
import { ApiClient, parseEnvelope } from './api-client';

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

  teamResource(projectId: Signal<string | undefined>): HttpResourceRef<TeamPage | undefined> {
    return httpResource<TeamPage | undefined>(
      () => {
        const id = projectId();
        return id ? this.api.url(`/teams/${id}`) : undefined;
      },
      { parse: (raw) => parseEnvelope<TeamPage>(raw) }
    );
  }

  follow(projectId: string): Observable<unknown> {
    return this.api.put(`/teams/${projectId}/follow`, {});
  }

  unfollow(projectId: string): Observable<unknown> {
    return this.api.delete(`/teams/${projectId}/follow`);
  }

  /** The export is a file, not an API envelope. */
  exportLibrary(format: 'csv' | 'json'): Observable<Blob> {
    return this.http.get(this.api.url('/library/export'), { params: { format }, responseType: 'blob' });
  }
}
