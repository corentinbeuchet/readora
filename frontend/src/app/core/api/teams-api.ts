import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Service, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MyTeam, ScanlationProject, ScanlationRole } from '@app/core/models/scanlation';
import { ApiClient, parseEnvelope } from './api-client';

/**
 * Running a team (US-12), `/api/v1/teams`: any signed-in reader; the server requires the caller to lead the team
 * for roster and series changes. The public team page is on `CommunityApi`.
 */
@Service()
export class TeamsApi {
  private readonly api = inject(ApiClient);

  /** The teams I belong to, with their task boards; idle until `enabled`. */
  mineResource(enabled: Signal<boolean>): HttpResourceRef<MyTeam[]> {
    return httpResource<MyTeam[]>(() => (enabled() ? this.api.url('/teams/mine') : undefined), {
      parse: (raw) => parseEnvelope<MyTeam[]>(raw) ?? [],
      defaultValue: []
    });
  }

  create(request: { name: string; description: string }): Observable<MyTeam> {
    return this.api.post<MyTeam>('/teams', request);
  }

  /** Adds `username` to the team, or replaces their roles. */
  setMember(teamId: string, username: string, roles: ScanlationRole[]): Observable<MyTeam> {
    return this.api.put<MyTeam>(`/teams/${teamId}/members/${encodeURIComponent(username)}`, { roles });
  }

  /** Starts the team's own task board for an existing series. */
  addSeries(teamId: string, workId: string): Observable<ScanlationProject> {
    return this.api.post<ScanlationProject>(`/teams/${teamId}/series`, { workId });
  }
}
