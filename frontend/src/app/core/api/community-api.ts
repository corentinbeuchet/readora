import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { PublicProfile, ReaderRef, TeamMember, TeamProfile } from '@app/core/models/community';
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

  /** A team's page with one page of its series (from 0). */
  teamResource(teamId: Signal<string | undefined>, seriesPage: Signal<number>): HttpResourceRef<TeamProfile | undefined> {
    return httpResource<TeamProfile | undefined>(
      () => {
        const id = teamId();
        const page = seriesPage();
        if (!id) {
          return undefined;
        }
        // The first page has no parameter: the same URL as a link to the team.
        return { url: this.api.url(`/teams/${id}`), params: page > 0 ? { page } : undefined };
      },
      { parse: (raw) => parseEnvelope<TeamProfile>(raw) }
    );
  }

  /** A team's members and their roles (the Studio roster), without the rest of its page. */
  membersResource(teamId: Signal<string | undefined>): HttpResourceRef<TeamMember[] | undefined> {
    return httpResource<TeamMember[] | undefined>(() => {
      const id = teamId();
      return id ? this.api.url(`/teams/${id}/members`) : undefined;
    }, { parse: (raw) => parseEnvelope<TeamMember[]>(raw) ?? [] });
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
